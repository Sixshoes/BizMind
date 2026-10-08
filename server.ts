import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { Client as NotionClient } from '@notionhq/client';
import { rateLimit } from 'express-rate-limit';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { normalizeCountry } from './utils/countries';

dotenv.config({ override: true });

// Initialize Firebase Admin (Using ADC or local service account if provided)
let firestoreDatabaseId: string | undefined = undefined;
let configProjectId: string | undefined = undefined;
let configStorageBucket: string | undefined = undefined;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.firestoreDatabaseId) {
      firestoreDatabaseId = config.firestoreDatabaseId;
    }
    if (config.projectId) {
      configProjectId = config.projectId;
    }
    if (config.storageBucket) {
      configStorageBucket = config.storageBucket;
    }
  }
} catch (e) {
  console.error("Failed to load firebase-applet-config.json on server-side", e);
}

if (!admin.apps.length) {
  const options: admin.AppOptions = {};
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      options.credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT", e);
    }
  }
  
  if (configProjectId) {
    options.projectId = configProjectId;
  }
  if (configStorageBucket) {
    options.storageBucket = configStorageBucket;
  } else {
    options.storageBucket = "ecoscan-sustainable.firebasestorage.app";
  }
  
  admin.initializeApp(options);
}

const db = firestoreDatabaseId ? getFirestore(admin.apps[0] || admin.app(), firestoreDatabaseId) : getFirestore();
const storage = admin.storage();

const normalizeSecret = (value: string | undefined): string => {
  if (!value) return "";
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^Bearer\s+/i, '');
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust the first proxy (AI Studio / Cloud Run infra)
  app.set('trust proxy', 1);

  // Rate Limiter: General Protection
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 300, // Limit each IP to 300 requests per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." }
  });

  // Stricter Limiter for expensive AI/Notion services (increased for batch migrations)
  const heavyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 200, // Limit each IP to 200 requests per minute
    message: { success: false, error: "Rate limit exceeded for AI/Notion services." }
  });

  const getAiClient = () => {
    const apiKey = normalizeSecret(process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.API_KEY);
    
    if (!apiKey) {
      const error: any = new Error("GEMINI_API_KEY is missing. Please ensure GEMINI_API_KEY is configured.");
      error.code = "AI_CONFIG_ERROR";
      throw error;
    }
    return new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  const notionImageProperty = normalizeSecret(process.env.NOTION_IMAGE_PROPERTY) || 'image_url';

  // --- Middleware ---
  // 1. 設定傳輸限制，支援名片圖片 Base64 (統一限制在 30MB 以確保高解析圖片順利傳輸)
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));

  // Apply general limiter to all /api routes
  app.use('/api/', apiLimiter);

  // Apply heavy limiter to expensive endpoints (AI 分析、Notion 寫入與大量讀取)
  app.use([
    '/api/chat', 
    '/api/analyze-card', 
    '/api/notion/save', 
    '/api/notion/load', 
    '/api/notion/delete/:id'
  ], heavyLimiter);

  /**
   * Extract image URL from Notion properties with fallback logic
   */
  const getImageUrlFromNotionProps = (p: any, mainKey: string): string => {
    const mainProp = p[mainKey];
    
    // 1. Check Main Key (URL or Files type)
    if (mainProp) {
        if (mainProp.type === 'url') return mainProp.url || '';
        if (mainProp.type === 'files' && mainProp.files.length > 0) {
            const firstFile = mainProp.files[0];
            return firstFile.external?.url || firstFile.file?.url || '';
        }
        // Fallback to text if someone used rich_text for the mainKey
        const val = getV(mainProp);
        if (val) return val;
    }

    // 2. No more legacy fallbacks
    return '';
  };

  // --- 2. Notion 解析工具 ---
  const getV = (p: any) => {
    if (!p) return '';
    if (p.type === 'url') return p.url || '';
    const content_list = p.title || p.rich_text || [];
    return content_list.map((c: any) => c.plain_text).join('');
  };

  const toRichText = (val: any) => {
    const str = String(val || '');
    // Notion API allows max 2000 chars per text element, and max 100 elements in a rich_text array.
    const chunks = str.match(/.{1,2000}/g) || [];
    const limitedChunks = chunks.slice(0, 100); 
    if (chunks.length > 100) {
      console.warn("Truncating rich text to 100 elements due to Notion API limits");
    }
    return { rich_text: limitedChunks.map(chunk => ({ text: { content: chunk } })) };
  };

  // --- 3. API：載入 Notion 資料 (GET) ---
  app.get('/api/notion/load', async (req, res) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const pageSize = 100;
      const apiKey = normalizeSecret(process.env.NOTION_API_KEY);
      if (!apiKey) throw new Error("[NOTION_CONFIG_ERROR] NOTION_API_KEY is missing. 請檢查環境變數。");
      
      const dbIdRaw = normalizeSecret(process.env.NOTION_DATABASE_ID);
      if (!dbIdRaw) throw new Error("[NOTION_CONFIG_ERROR] NOTION_DATABASE_ID is missing. 請檢查環境變數。");

      const resp = await fetch(`https://api.notion.com/v1/databases/${dbIdRaw}/query`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json', 
          'Notion-Version': '2022-06-28' 
        },
        body: JSON.stringify({ 
          page_size: pageSize,
          start_cursor: cursor || undefined 
        })
      });
      
      const json: any = await resp.json();
      if (!resp.ok) throw new Error(json.message);

      const data = (json.results || []).map((page: any) => {
        const p = page.properties;
        return {
          id: page.id,
          名稱: getV(p['名稱']),
          firstName: getV(p['firstName']),
          lastName: getV(p['lastName']),
          company: getV(p['company']),
          department: getV(p['department']),
          title: getV(p['job_title']),
          email: p['email']?.email || '',
          phone: getV(p['phone']),
          address: getV(p['address']),
          category: getV(p['category']),
          scannedAt: p['scannedAt']?.number || Date.now(),
          rotation: p['rotation']?.number || 0,
          imageUrl: getImageUrlFromNotionProps(p, notionImageProperty),
          translations: {
            company: getV(p['trans_company']),
            title: getV(p['trans_title']),
            department: getV(p['trans_dept']),
            industry: getV(p['trans_ind']),
            subject: getV(p['trans_subj']),
            country: normalizeCountry(getV(p['trans_ctry'])),
          },
          website: getV(p['website']),
          prefix: getV(p['prefix']),
          industry: getV(p['industry']),
          country: normalizeCountry(getV(p['country'])),
          subject: getV(p['subject']),
          source: getV(p['source']),
          notes: getV(p['notes']),
          summary: getV(p['summary']),
          reasoning: getV(p['reasoning']),
          physicalCount: p['physicalCount']?.number !== undefined ? p['physicalCount']?.number : 1,
          syncStatus: 'notion',
          syncedToNotion: true
        };
      });

      res.json({ success: true, data, has_more: json.has_more, next_cursor: json.next_cursor });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Simple in-memory cache for database properties to optimize performance
  let cachedSchema: { [dbId: string]: { props: any, timestamp: number } } = {};
  const CACHE_TTL = 300000; // 5 minutes

  // --- 4. API：存入 Notion 資料 (POST) ---
  app.post('/api/notion/save', async (req, res) => {
    try {
      const data = req.body;

      const apiKey = normalizeSecret(process.env.NOTION_API_KEY);
      if (!apiKey) throw new Error("[NOTION_CONFIG_ERROR] NOTION_API_KEY is missing.");

      const dbIdClean = normalizeSecret(process.env.NOTION_DATABASE_ID);
      if (!dbIdClean) throw new Error("[NOTION_CONFIG_ERROR] NOTION_DATABASE_ID is missing.");

      // 1. Schema Guard with Caching
      let validProps = {};
      const now = Date.now();
      if (cachedSchema[dbIdClean] && (now - cachedSchema[dbIdClean].timestamp < CACHE_TTL)) {
          validProps = cachedSchema[dbIdClean].props;
      } else {
          const dbResp = await fetch(`https://api.notion.com/v1/databases/${dbIdClean}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Notion-Version': '2022-06-28'
            }
          });
          if (!dbResp.ok) {
              const dbErr: any = await dbResp.json();
              throw new Error(`[NOTION_SCHEMA_ERROR] ${dbErr.message || 'Failed to fetch database schema'}`);
          }
          const dbSchema: any = await dbResp.json();
          validProps = dbSchema.properties || {};
          cachedSchema[dbIdClean] = { props: validProps, timestamp: now };
      }

      // Check for required '名稱' (Title) field
      if (!validProps['名稱'] || (validProps['名稱'] as any).type !== 'title') {
          throw new Error("[NOTION_CONFIG_ERROR] 資料庫中缺少型別為 'title' 的 '名稱' 欄位。");
      }

      const filteredProps: any = {};
      const droppedKeys: string[] = [];

      // 2. Optimized Payload Builder
      const buildProp = (key: string, value: any) => {
          const schema = (validProps as any)[key];
          if (!schema) {
              droppedKeys.push(key);
              return null;
          }

          const type = schema.type;
          if (value === undefined || value === null || String(value).trim() === '') return null;

          try {
              switch (type) {
                  case 'title':
                      return { title: [{ text: { content: String(value).substring(0, 2000) } }] };
                  case 'rich_text':
                      return { rich_text: [{ text: { content: String(value).substring(0, 2000) } }] };
                  case 'url':
                      const urlStr = String(value).trim();
                      if (!/^https?:\/\/[^\s]+$/i.test(urlStr)) {
                          droppedKeys.push(`${key}(invalid url: ${urlStr.substring(0, 20)}...)`);
                          return null;
                      }
                      return { url: urlStr };
                  case 'number':
                      const num = Number(value);
                      if (isNaN(num)) {
                          droppedKeys.push(`${key}(not a number)`);
                          return null;
                      }
                      return { number: num };
                  case 'email':
                      return { email: String(value).trim() };
                  case 'phone_number':
                      return { phone_number: String(value).trim() };
                  case 'select':
                      return { select: { name: String(value).trim().substring(0, 100) } };
                  default:
                      droppedKeys.push(`${key}(unsupported type: ${type})`);
                      return null;
              }
          } catch (e) {
              droppedKeys.push(`${key}(build error)`);
              return null;
          }
      };

      // 3. Populate Properties
      // ID as Name (Required)
      filteredProps['名稱'] = { title: [{ text: { content: data.notionId || data.id || 'new_entry' } }] };
      
      const apply = (key: string, val: any) => {
          const p = buildProp(key, val);
          if (p) filteredProps[key] = p;
      };

      apply('scannedAt', data.scannedAt);
      apply('rotation', data.rotation);
      apply('email', data.email);
      apply('website', data.website);
      apply('phone', data.phone);
      apply('address', data.address);
      apply('firstName', data.firstName);
      apply('lastName', data.lastName);
      apply('company', data.company);
      apply('department', data.department);
      apply('category', data.category);
      apply('industry', data.industry);
      apply('country', normalizeCountry(data.country));
      apply('prefix', data.prefix);
      apply('subject', data.subject);
      apply('source', data.source);
      apply('notes', data.notes);
      apply('summary', data.summary);
      apply('reasoning', data.reasoning);
      apply('physicalCount', data.physicalCount);
      
      if (data.title) apply('job_title', data.title);
      if (data.imageUrl) apply(notionImageProperty, data.imageUrl);

      // --- Image Reference Counting ---
      if (data.imageId) {
        try {
          const assetRef = db.collection('image_assets').doc(data.imageId);
          await db.runTransaction(async (transaction) => {
            const assetDoc = await transaction.get(assetRef);
            if (assetDoc.exists) {
              const isUpdate = !!((data.notionPageId || data.notionId) && (data.notionPageId || data.notionId).length >= 32);
              if (!isUpdate) {
                transaction.update(assetRef, { 
                  refCount: admin.firestore.FieldValue.increment(1),
                  updatedAt: Date.now(),
                  status: 'active'
                });
              } else if (data.oldImageId && data.oldImageId !== data.imageId) {
                const oldAssetRef = db.collection('image_assets').doc(data.oldImageId);
                transaction.update(oldAssetRef, { 
                  refCount: admin.firestore.FieldValue.increment(-1),
                  updatedAt: Date.now()
                });
                transaction.update(assetRef, { 
                  refCount: admin.firestore.FieldValue.increment(1),
                  updatedAt: Date.now(),
                  status: 'active'
                });
              }
            }
          });
        } catch (e) {
          console.error("RefCount Error:", e);
        }
      }

      if (data.translations) {
          apply('trans_company', data.translations.company);
          apply('trans_title', data.translations.title);
          apply('trans_dept', data.translations.department);
          apply('trans_ind', data.translations.industry);
          apply('trans_subj', data.translations.subject);
          apply('trans_ctry', data.translations.country);
      }

      // 4. Determine Request Mode (Update based on notionPageId, else Create)
      // notionPageId is the globally unique ID for a Notion page (UUID)
      const pageId = data.notionPageId || data.notionId;
      const isUpdate = !!(pageId && (pageId.length >= 32));

      let url = isUpdate 
        ? `https://api.notion.com/v1/pages/${pageId}`
        : `https://api.notion.com/v1/pages`;
      
      let method = isUpdate ? 'PATCH' : 'POST';
      let body: any = isUpdate 
        ? { properties: filteredProps }
        : { parent: { database_id: dbIdClean }, properties: filteredProps };

      const resp = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json', 
          'Notion-Version': '2022-06-28' 
        },
        body: JSON.stringify(body)
      });
      
      const json: any = await resp.json();
      
        if (!resp.ok) {
            console.error("[NOTION API FAILURE]", {
                status: resp.status,
                code: json.code,
                message: json.message,
                sentKeys: Object.keys(filteredProps),
                droppedKeys
            });

            // If it's a validation error, the schema might have changed. Clear cache.
            if (json.code === 'validation_error') {
                console.log(`[NOTION_INFO] Validation error detected. Clearing schema cache for ${dbIdClean}.`);
                delete cachedSchema[dbIdClean];
            }

            throw new Error(`[NOTION_API_ERROR] ${json.code || 'unknown'}: ${json.message || JSON.stringify(json)}`);
        }

      res.json({ 
        success: true, 
        notionId: json.id, 
        droppedKeys: droppedKeys.length > 0 ? droppedKeys : undefined 
      });
    } catch (e: any) { 
      console.error("[SERVER_ERROR] notion/save:", e);
      res.status(500).json({ success: false, error: e.message }); 
    }
  });

  // --- 5. API：邏輯刪除 Notion (notion.pages.update archived: true) ---
  app.delete('/api/notion/delete/:id', async (req, res) => {
    try {
      const pageId = req.params.id;
      const { imageId } = req.query;
      const apiKey = normalizeSecret(process.env.NOTION_API_KEY);
      if (!apiKey) {
        throw new Error("[NOTION_CONFIG_ERROR] NOTION_API_KEY is missing.");
      }

      const notion = new NotionClient({ auth: apiKey });
      
      try {
        await notion.pages.update({
          page_id: pageId,
          archived: true,
        });
      } catch (notionErr: any) {
        // Handle case where page is already deleted or not found
        const errMsg = notionErr.message || '';
        const isNotFound = notionErr.status === 404 || notionErr.code === 'object_not_found' || errMsg.includes('Could not find page');
        if (isNotFound) {
          console.warn(`[SERVER] Page ${pageId} already deleted from Notion or not found.`);
        } else {
          throw notionErr;
        }
      }

      // Decrement refCount if imageId is provided
      if (imageId && typeof imageId === 'string') {
        try {
          const assetRef = db.collection('image_assets').doc(imageId);
          await db.runTransaction(async (transaction) => {
            const assetDoc = await transaction.get(assetRef);
            if (assetDoc.exists) {
              const currentCount = assetDoc.data()?.refCount || 0;
              const newCount = Math.max(0, currentCount - 1);
              const updateData: any = { 
                refCount: newCount,
                updatedAt: Date.now()
              };
              
              // If refCount hits 0, mark for deletion in 24h
              if (newCount === 0) {
                updateData.status = 'pending_delete';
                updateData.deleteAfter = Date.now() + (24 * 60 * 60 * 1000);
              }
              
              transaction.update(assetRef, updateData);
            }
          });
        } catch (e) {
          console.error("Delete RefCount Error:", e);
        }
      }

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // --- 5.1 API：搜尋 Notion 垃圾桶／已封存名片 (GET) ---
  app.get('/api/notion/archived', async (req, res) => {
    try {
      const apiKey = normalizeSecret(process.env.NOTION_API_KEY);
      if (!apiKey) throw new Error("[NOTION_CONFIG_ERROR] NOTION_API_KEY is missing.");
      
      const dbIdRaw = normalizeSecret(process.env.NOTION_DATABASE_ID);
      const cleanDbId = dbIdRaw ? dbIdRaw.replace(/-/g, '').toLowerCase() : '';

      let hasMore = true;
      let nextCursor: string | undefined = undefined;
      const allArchivedPages: any[] = [];
      let totalSearchedPages = 0;

      // Strategies to find pages:
      // Strategy 1: Search with object: 'page' filter and last_edited_time sort
      while (hasMore && allArchivedPages.length < 500 && totalSearchedPages < 1000) {
        const bodyPayload: any = {
          filter: {
            property: 'object',
            value: 'page'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          },
          page_size: 100
        };
        if (nextCursor) bodyPayload.start_cursor = nextCursor;

        const resp = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${apiKey}`, 
            'Content-Type': 'application/json', 
            'Notion-Version': '2022-06-28' 
          },
          body: JSON.stringify(bodyPayload)
        });

        const json: any = await resp.json();
        if (!resp.ok) {
          console.error("[NOTION_SEARCH_ERROR]", json);
          break;
        }

        const results = json.results || [];
        totalSearchedPages += results.length;

        for (const page of results) {
          const parentDb = page.parent?.database_id ? page.parent.database_id.replace(/-/g, '').toLowerCase() : '';
          const isOurDb = !cleanDbId || parentDb === cleanDbId || !parentDb;
          const isArchived = Boolean(page.archived || page.in_trash);

          if (isArchived && isOurDb) {
            allArchivedPages.push(page);
          }
        }

        hasMore = Boolean(json.has_more && results.length > 0);
        nextCursor = json.next_cursor;
      }

      console.log(`[NOTION_ARCHIVED_CHECK] Total searched: ${totalSearchedPages}, Archived found: ${allArchivedPages.length}, DB: ${cleanDbId}`);

      const archivedCards = allArchivedPages.map((page: any) => {
        const p = page.properties || {};
        return {
          id: page.id,
          名稱: getV(p['名稱']),
          firstName: getV(p['firstName']),
          lastName: getV(p['lastName']),
          company: getV(p['company']),
          department: getV(p['department']),
          title: getV(p['job_title']),
          email: p['email']?.email || '',
          phone: getV(p['phone']),
          address: getV(p['address']),
          category: getV(p['category']) || 'other',
          scannedAt: p['scannedAt']?.number || new Date(page.last_edited_time || Date.now()).getTime(),
          rotation: p['rotation']?.number || 0,
          imageUrl: getImageUrlFromNotionProps(p, notionImageProperty),
          translations: {
            company: getV(p['trans_company']),
            title: getV(p['trans_title']),
            department: getV(p['trans_dept']),
            industry: getV(p['trans_ind']),
            subject: getV(p['trans_subj']),
            country: normalizeCountry(getV(p['trans_ctry'])),
          },
          website: getV(p['website']),
          prefix: getV(p['prefix']),
          industry: getV(p['industry']),
          country: normalizeCountry(getV(p['country'])),
          subject: getV(p['subject']),
          source: getV(p['source']),
          notes: getV(p['notes']),
          summary: getV(p['summary']),
          reasoning: getV(p['reasoning']),
          physicalCount: p['physicalCount']?.number !== undefined ? p['physicalCount']?.number : 1,
          syncStatus: 'notion',
          syncedToNotion: true,
          archivedTime: page.last_edited_time
        };
      });

      res.json({ success: true, count: archivedCards.length, archivedCards });
    } catch (e: any) {
      console.error("[SERVER_ERROR] notion/archived:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 5.2 API：一鍵還原 Notion 垃圾桶名片 (POST) ---
  app.post('/api/notion/restore', async (req, res) => {
    try {
      const { pageIds } = req.body;
      if (!Array.isArray(pageIds) || pageIds.length === 0) {
        return res.status(400).json({ success: false, error: "Missing pageIds array" });
      }

      const apiKey = normalizeSecret(process.env.NOTION_API_KEY);
      if (!apiKey) throw new Error("[NOTION_CONFIG_ERROR] NOTION_API_KEY is missing.");

      let restoredCount = 0;
      const failedIds: string[] = [];

      for (const pageId of pageIds) {
        try {
          const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 
              'Authorization': `Bearer ${apiKey}`, 
              'Content-Type': 'application/json', 
              'Notion-Version': '2022-06-28' 
            },
            body: JSON.stringify({ archived: false })
          });

          if (resp.ok) {
            restoredCount++;
          } else {
            failedIds.push(pageId);
          }
        } catch (err) {
          failedIds.push(pageId);
        }
      }

      res.json({ success: true, restoredCount, failedCount: failedIds.length });
    } catch (e: any) {
      console.error("[SERVER_ERROR] notion/restore:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 6. API：Gemini OCR 與分析 (POST) ---
  app.post('/api/analyze-card', async (req, res) => {
    try {
      const { action, image, mimeType, card, cards } = req.body;
      const ai = getAiClient();
      const model = 'gemini-3.8-flash';

      if (action === 'summaryFromText') {
        const prompt = `請根據以下名片資訊，撰寫一段「精簡專業」的介紹文 (約 50-100 字，繁體中文)。\n姓名: ${card.lastName}${card.firstName}\n公司: ${card.company}\n職稱: ${card.title}\n部門: ${card.department || ''}\n產業: ${card.industry || ''}\n備註: ${card.notes || ''}\n【撰寫要求】：直接回傳純文字，不需標題。`;
        const response = await ai.models.generateContent({ model, contents: prompt });
        return res.json({ success: true, summary: response.text?.trim() || "" });
      }

      if (action === 'batchSummaries') {
        const simplifiedData = cards.map((c: any) => ({
            id: c.id, name: `${c.lastName}${c.firstName}`, company: c.company, title: c.title, department: c.department || '', industry: c.industry || '', notes: c.notes || ''
        }));
        const prompt = `你是專業的名片分析師。請為以下 JSON 陣列中的每一筆名片資料，生成一段「精簡專業」的介紹文 (約 50-80 字，繁體中文)。\n【輸入資料】:\n${JSON.stringify(simplifiedData)}\n請回傳 JSON Array: [{"id": "對應ID", "summary": "介紹文"}]`;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { 
                      type: Type.OBJECT, 
                      properties: { id: { type: Type.STRING }, summary: { type: Type.STRING } }, 
                      required: ["id", "summary"] 
                    }
                }
            }
        });
        const summaries = response.text ? JSON.parse(response.text) : [];
        return res.json({ success: true, summaries });
      }

      if (action === 'extractInfo') {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              { text: `你是一位專業的名片資料分析專家，專門為 QS Hub 系統處理全球名片。請提取肉眼可見的資訊，並以 JSON 格式回傳。包含 firstName, lastName, title, company, email, phone 等欄位。
【嚴格規則】：
1. **絕對忠於原圖**：僅提取名片上「肉眼可見」的文字資訊。若名片上沒有該資訊，請留空，嚴禁自行推測。
2. **語言處理**：
   - **英文/中文名片**：若名片包含英文，主要欄位請「優先提取英文」。若僅有中文，則提取中文。
   - **非中英名片**：若名片主要語言為**非中文且非英文**，請**直接提取名片上的原文**。
3. **店家/通用名片**：若該圖片是店家、餐廳或企業的通用名片，請務必將 firstName, lastName, title, prefix **全部留空 ("")**。
4. **分類強制規則**：若無法提取出 **lastName (姓氏)**，代表此名片無法歸戶到特定人士，請務必將 category 設定為 **'other'**。

5. **方向與旋轉容錯**：若名片或文件中的文字呈現旋轉（例如逆時針/順時針旋轉 90 度、180 度或顛倒），或為 A4 平板掃描中的局部名片，請自動多方向校正閱讀並完整提取正確內容。
6. **國家/地區標準 (QS Hub Country)**：請務必將名片所屬國家轉換為標準英文名稱。特別嚴格注意：台灣一律輸出為 "Taiwan SAR"（嚴禁輸出 Taiwan, ROC 或 台灣），中國一律輸出為 "China Mainland"，香港為 "Hong Kong SAR"，澳門為 "Macau SAR"，美國為 "United States"，日本為 "Japan"。

【多重資料提取規則】：
- **電話 (Phone)**：請提取名片上「所有」可見的**電話、手機、公司總機**號碼。若有多組，請用 " / " 分隔。**不要包含傳真號碼**。
- **傳真 (Fax)**：請提取名片上標示為 Fax 或 傳真 的號碼。若有多組，請用 " / " 分隔。
- **電子郵件 (Email)**：請提取名片上「所有」可見的電子郵件，若有多組信箱，請用 " / " 分隔。

【AI 生成欄位 (需區分兩個不同欄位)】：
1. **summary (名片簡介)**：請生成一段「精簡專業」的介紹文 (約 50-100 字，繁體中文)。
   - 內容結構：介紹 [姓名] 為 [公司] 的 [職稱]。
   - 延伸內容：根據其公司性質與職稱，簡單描述其角色。
   - **嚴格禁止**：若名片缺少資訊，請直接忽略該資訊，**絕不可**在文中寫「未提供」、「無顯示」或類似字眼。
   - 語氣：專業、商務、流暢。
   
2. **reasoning (分類依據)**：請說明為什麼將其歸類為 Academic、Employer、Staff 或 Other。

請以 JSON 格式回傳。` },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                prefix: { type: Type.STRING },
                firstName: { type: Type.STRING },
                lastName: { type: Type.STRING },
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                department: { type: Type.STRING },
                industry: { type: Type.STRING },
                country: { type: Type.STRING },
                email: { type: Type.STRING },
                subject: { type: Type.STRING },
                phone: { type: Type.STRING },
                fax: { type: Type.STRING },
                website: { type: Type.STRING },
                address: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["employer", "academic", "staff", "other"] },
                summary: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                translations: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    company: { type: Type.STRING },
                    department: { type: Type.STRING },
                    industry: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    country: { type: Type.STRING }
                  }
                }
              },
              required: ["firstName", "lastName", "title", "company", "category", "summary", "reasoning", "translations"],
            },
          },
        });
        const data = response.text ? JSON.parse(response.text) : {};
        if (data.country) data.country = normalizeCountry(data.country);
        if (data.translations?.country) data.translations.country = normalizeCountry(data.translations.country);
        return res.json({ success: true, result: data });
      }

      if (action === 'detectCards') {
        const response = await ai.models.generateContent({
            model, 
            contents: {
              parts: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
                { text: "Identify the bounding boxes for each business card (or business card text cluster / contact information area) in this image. Note: 1) The image may be a scanned document (e.g. A4 flatbed scan) where the card has a white background with no distinct physical borders; in that case, detect the bounding box around the cluster of contact details/logo. 2) The card or text may be oriented horizontally or vertically (rotated 90, 180, or 270 degrees). Return JSON with 'boxes' array where coordinates are normalized integers or numbers from 0 to 1000." },
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  boxes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { ymin: { type: Type.NUMBER }, xmin: { type: Type.NUMBER }, ymax: { type: Type.NUMBER }, xmax: { type: Type.NUMBER } },
                      required: ["ymin", "xmin", "ymax", "xmax"]
                    }
                  }
                }
              }
            }
        });
        const data = response.text ? JSON.parse(response.text) : { boxes: [] };
        return res.json({ success: true, boxes: data.boxes || [] });
      }

      return res.status(400).json({ success: false, error: "Invalid action" });
    } catch (e: any) { 
      console.error("[SERVER_ERROR] analyze-card:", e);
      const rawMsg = e?.message || String(e);
      let userFriendlyError = rawMsg;
      if (rawMsg.includes('spending cap') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        userFriendlyError = "Google AI 專案已達本月支出上限 (Monthly Spending Cap) 或配額用盡。請至 https://ai.studio/spend 調整預算上限或在專案設定中更換 API Key。";
      } else if (rawMsg.includes('API key not valid') || rawMsg.includes('API_KEY_INVALID')) {
        userFriendlyError = "Google Gemini API Key 無效或尚未設定。請確認 GEMINI_API_KEY 環境變數。";
      }
      res.status(500).json({ success: false, error: userFriendlyError, details: e.details || null }); 
    }
  });

  // --- 6.5. Debug Env ---
  app.get('/api/debug-env', (req, res) => {
    if (process.env.NODE_ENV === 'production' || process.env.DEBUG_API_ENABLED !== 'true') {
      return res.status(404).send('Not Found');
    }
    const k = normalizeSecret(process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.API_KEY);
    res.json({
      node_env: process.env.NODE_ENV,
      key_len: k.length
    });
  });

  // --- AI：意圖分析 (POST) ---
  app.post('/api/chat/intent', heavyLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ success: false, error: "Missing prompt" });

      const ai = getAiClient();
      const model = 'gemini-3.8-flash'; // Use gemini-3.8-flash for intent extraction

      const response = await ai.models.generateContent({
        model,
        contents: `分析使用者的對話意圖，並提取搜尋過濾條件。
使用者輸入：${prompt}

規則：
1. searchText: 使用者想搜尋的關鍵字（姓名、公司、職稱等）。
2. category: 'all' | 'employer' | 'academic' | 'staff' | 'other'。
3. country: 使用者想篩選的國家名稱（若有提到特定國家如「台灣」、「日本」、「美國」、「捷克」等）。
4. requireEmail: 布林值，使用者是否明確要求必須有 Email。
5. requirePhone: 布林值，使用者是否明確要求必須有電話。
6. intentType: 'card_search' (搜尋特定對象) 或 'general_chat' (一般閒聊)。

請以 JSON 格式回應。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              searchText: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: ['all', 'employer', 'academic', 'staff', 'other'] 
              },
              country: { type: Type.STRING },
              requireEmail: { type: Type.BOOLEAN },
              requirePhone: { type: Type.BOOLEAN },
              intentType: { 
                type: Type.STRING, 
                enum: ['card_search', 'general_chat'] 
              }
            },
            required: ['intentType']
          }
        }
      });

      const intent = JSON.parse(response.text || "{}");
      res.json({ success: true, intent });
    } catch (e: any) {
      console.error("Intent Extraction Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 7.5. API：圖片資產管理 (POST) ---
  app.post('/api/images', heavyLimiter, async (req, res) => {
    try {
      const { base64, url, cardId } = req.body;
      if (!base64 && !url) return res.status(400).json({ success: false, error: "Missing image data or URL" });

      let mimeType = 'image/jpeg';
      let extension = 'jpg';
      let buffer: Buffer;

      if (base64) {
        mimeType = base64.match(/data:(.*?);/)?.[1] || 'image/jpeg';
        extension = mimeType.split('/')[1] || 'jpg';
        const base64String = base64.includes(',') ? base64.split(',')[1] : base64;
        buffer = Buffer.from(base64String, 'base64');
      } else {
        // Fetch from URL
        const imageResponse = await fetch(url);
        if (!imageResponse.ok) throw new Error(`Failed to fetch image from URL: ${url}`);
        const arrayBuffer = await imageResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
        extension = mimeType.split('/')[1] || 'jpg';
      }
      
      // Calculate SHA256 for deduplication
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Check if image already exists
      const existingAssets = await db.collection('image_assets')
        .where('sha256', '==', hash)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!existingAssets.empty) {
        const asset = existingAssets.docs[0].data();
        return res.json({ success: true, imageId: existingAssets.docs[0].id, downloadUrl: asset.downloadUrl });
      }

      // Upload new image
      const imageId = crypto.randomUUID();
      const storagePath = `business_cards/${imageId}.${extension}`;
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      
      await file.save(buffer, {
        metadata: { contentType: mimeType },
        public: true
      });

      const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      const assetData = {
        id: imageId,
        storagePath,
        downloadUrl,
        sha256: hash,
        refCount: 0,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.collection('image_assets').doc(imageId).set(assetData);

      res.json({ success: true, imageId, downloadUrl });
    } catch (e: any) {
      console.error("Image Upload Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GC Worker Endpoint
  app.post('/api/images/gc', heavyLimiter, async (req, res) => {
    try {
      const now = Date.now();
      const snapshot = await db.collection('image_assets')
        .where('status', '==', 'pending_delete')
        .where('deleteAfter', '<=', now)
        .get();

      let deletedCount = 0;
      const bucket = storage.bucket();

      for (const doc of snapshot.docs) {
        const asset = doc.data();
        // Double check refCount
        if (asset.refCount <= 0) {
          try {
            await bucket.file(asset.storagePath).delete();
            await doc.ref.update({ status: 'deleted', updatedAt: now });
            deletedCount++;
          } catch (storageErr: any) {
            console.error(`Failed to delete storage file ${asset.storagePath}:`, storageErr);
            // If file not found, still mark as deleted in DB
            if (storageErr.code === 404) {
              await doc.ref.update({ status: 'deleted', updatedAt: now });
            }
          }
        }
      }

      res.json({ success: true, deletedCount });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 7. API：智慧對話 (POST) ---
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, isSearchEnabled, cards } = req.body;
      
      // Diagnostic check
      const aiKey = normalizeSecret(process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.API_KEY);

      if (!aiKey) {
        return res.status(500).json({ 
          success: false, 
          code: "AI_CONFIG_ERROR",
          error: "GEMINI_API_KEY is missing" 
        });
      }
      
      if (!prompt) return res.status(400).json({ success: false, error: "Missing prompt" });
      
      const ai = getAiClient();
      const model = 'gemini-3.8-flash';

      const config: any = {};
      if (isSearchEnabled) {
        config.tools = [{ googleSearch: {} }];
      }

      let systemInstruction = "你是專為 QS Hub 名片管理系統設計的專業 AI 助理。";
      
      const hasCards = cards && Array.isArray(cards) && cards.length > 0;

    if (hasCards) {
        // Limit to 30 cards and only essential fields to save tokens and improve performance
        const limitedCards = cards.slice(0, 30).map(c => ({
          ID: c.id,
          姓名: `${c.lastName || ""}${c.firstName || ""}`,
          公司: c.company || "",
          職稱: c.title || "",
          產業: c.industry || "",
          Email: c.email || "",
          電話: c.phone || ""
        }));

        systemInstruction += `\n\n【名片數據庫基準】(請以此為搜尋與連結基準)：\n目前系統已載入 ${limitedCards.length} 張名片 (顯示前 30 筆)。資料摘要如下：\n${JSON.stringify(limitedCards)}\n\n`;
        
        if (isSearchEnabled) {
          systemInstruction += "【任務指令】：\n1. 請以「名片數據庫」中提供的公司名稱、姓名、Email 作為關鍵字。 當使用者詢問相關人員或公司時，請務必先參考名片資料。\n2. 若開啟「聯網搜尋」，請針對名片中的「公司」或「人員」進行交叉搜尋（搜尋對方的最新背景、新聞或官方資訊）。\n3. 如果對話中明確涉及某位聯絡人，請務必回傳該人員對應的 'linkedCardId'。";
        } else {
          systemInstruction += "【任務指令】：請僅根據提供的名片數據進行回答。如果對話涉及某位聯絡人，請回傳對應的 'linkedCardId'。";
        }
      }

      if (isSearchEnabled) {
        systemInstruction += "\n\n【聯網搜尋規範】：\n1. 當你從網路獲取資訊時，請在回答末尾明確標註來源連結。\n2. 若使用者詢問的問題與名片無關，仍可正常進行網路搜尋。";
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...config,
          systemInstruction: systemInstruction + "\n\n請務必以 JSON 格式回答，包含三個欄位：'reply' (你的回答文字), 'linkedCards' (一個陣列，若使用者提到多張名片或有多個符合結果，請填入包含 'id' 與 'name' 物件的陣列，否則為空陣列)。",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              linkedCards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING }
                  },
                  required: ["id", "name"]
                }
              }
            },
            required: ["reply"]
          }
        }
      });

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const parsed = JSON.parse(response.text || "{}");
      const reply = parsed.reply || "";
      const linkedCards = parsed.linkedCards || [];
      
      let sources: { title: string; url: string }[] = [];
      if (groundingMetadata?.groundingChunks) {
        sources = groundingMetadata.groundingChunks
          .map((chunk: any) => ({
            title: chunk.web?.title || "來源",
            url: chunk.web?.uri || ""
          }))
          .filter((s: any) => s.url);
      }

      res.json({ 
        success: true, 
        reply,
        sources,
        linkedCards
      });
    } catch (e: any) { 
      console.error("[SERVER_ERROR] chat:", e);
      res.status(500).json({ success: false, error: e.message }); 
    }
  });

  // --- 8. 解決部署與路徑問題 ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();
