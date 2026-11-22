import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { rateLimit } from 'express-rate-limit';
import { normalizeCountry } from './utils/countries.js';
import { detectCardClockwiseRotation } from './utils/cardOrientationServer.js';

dotenv.config({ override: true });

const normalizeSecret = (value: string | undefined): string => {
  if (!value) return '';
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^Bearer\s+/i, '');
};

let cachedAiClient: GoogleGenAI | null = null;
let cachedAiKey = '';

const getAiClient = () => {
  const apiKey = normalizeSecret(
    process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.API_KEY
  );
  if (!apiKey) {
    const error: any = new Error(
      'GEMINI_API_KEY is missing. Please ensure GEMINI_API_KEY is configured.'
    );
    error.code = 'AI_CONFIG_ERROR';
    throw error;
  }
  if (!cachedAiClient || cachedAiKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({ apiKey });
    cachedAiKey = apiKey;
  }
  return cachedAiClient;
};

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const FALLBACK_MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-2.5-flash'];

async function generateContentWithFallback(ai: GoogleGenAI, params: { contents: any; config?: any }) {
  const candidates = Array.from(new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]));
  let lastError: any = null;
  for (const model of candidates) {
    try {
      return await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const isModelError =
        err?.status === 404 ||
        msg.includes('not found') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('not supported');
      if (!isModelError) {
        throw err;
      }
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
  });

  const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    message: { success: false, error: 'Rate limit exceeded for AI services.' },
  });

  app.use('/api', apiLimiter);

  // --- 1. API: Auto-upright card orientation ---
  app.post('/api/cards/auto-upright', heavyLimiter, async (req, res) => {
    try {
      const { base64, mimeType } = req.body || {};

      // Single base64 image mode (used during new scan pipeline)
      if (base64 && typeof base64 === 'string') {
        const cleanB64 = base64.includes(',') ? base64.split(',')[1] : base64;
        const buf = Buffer.from(cleanB64, 'base64');
        const det = detectCardClockwiseRotation(buf, mimeType || 'image/jpeg', 0);
        return res.json({
          success: true,
          rotation: det ? det.recommendedRotation : 0,
          analysis: det,
        });
      }

      const inputCards: Array<{
        id: string;
        imageUrl?: string;
        backImageUrl?: string;
        rotation?: number;
        backRotation?: number;
      }> = Array.isArray(req.body?.cards) ? req.body.cards : [];

      if (inputCards.length === 0) {
        return res.json({ success: true, updates: [], changedCount: 0 });
      }

      const updates: Array<{
        id: string;
        rotation: number;
        backRotation?: number;
        changed: boolean;
      }> = [];

      const analyzeUrlOrDataUri = async (
        src: string | undefined,
        curRot: number
      ): Promise<number> => {
        if (!src) return curRot;
        try {
          if (src.startsWith('data:')) {
            const m = src.match(/^data:(.*?);base64,(.*)$/);
            if (!m) return curRot;
            const buf = Buffer.from(m[2], 'base64');
            const det = detectCardClockwiseRotation(buf, m[1] || 'image/jpeg', curRot);
            return det ? det.recommendedRotation : curRot;
          }
          if (src.startsWith('http')) {
            const resp = await fetch(src);
            if (!resp.ok) return curRot;
            const buf = Buffer.from(await resp.arrayBuffer());
            const ct = resp.headers.get('content-type') || 'image/jpeg';
            const det = detectCardClockwiseRotation(buf, ct, curRot);
            return det ? det.recommendedRotation : curRot;
          }
        } catch {
          // keep current rotation on network error
        }
        return curRot;
      };

      const CONCURRENCY = 10;
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, inputCards.length) },
        async () => {
          while (cursor < inputCards.length) {
            const item = inputCards[cursor++];
            const curFront = Number(item.rotation || 0);
            const curBack = Number(item.backRotation || 0);
            const nextFront = await analyzeUrlOrDataUri(item.imageUrl, curFront);
            const nextBack = item.backImageUrl
              ? await analyzeUrlOrDataUri(item.backImageUrl, curBack)
              : curBack;
            const normCurFront = (((Math.round(curFront / 90) * 90) % 360) + 360) % 360;
            const normCurBack = (((Math.round(curBack / 90) * 90) % 360) + 360) % 360;
            const changed =
              nextFront !== curFront ||
              nextFront !== normCurFront ||
              (Boolean(item.backImageUrl) && (nextBack !== curBack || nextBack !== normCurBack));
            updates.push({
              id: item.id,
              rotation: nextFront,
              backRotation: item.backImageUrl ? nextBack : curBack,
              changed,
            });
          }
        }
      );
      await Promise.all(workers);

      const changedCount = updates.filter((u) => u.changed).length;
      res.json({ success: true, updates, changedCount });
    } catch (e: any) {
      console.error('[SERVER_ERROR] cards/auto-upright:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 2. API: Gemini OCR, Dual-Side Merge & Follow-up Email ---
  app.post('/api/analyze-card', async (req, res) => {
    try {
      const { action, image, imageUrl, mimeType, card, cards } = req.body;
      const ai = getAiClient();

      if (action === 'summaryFromText') {
        const prompt = `請根據以下名片資訊，撰寫一段「精簡專業」的介紹文 (約 50-100 字，繁體中文)。\n姓名: ${card.lastName}${card.firstName}\n公司: ${card.company}\n職稱: ${card.title}\n部門: ${card.department || ''}\n產業: ${card.industry || ''}\n備註: ${card.notes || ''}\n【撰寫要求】：直接回傳純文字，不需標題。`;
        const response = await generateContentWithFallback(ai, { contents: prompt });
        return res.json({ success: true, summary: response.text?.trim() || '' });
      }

      if (action === 'batchSummaries') {
        const simplifiedData = cards.map((c: any) => ({
          id: c.id,
          name: `${c.lastName}${c.firstName}`,
          company: c.company,
          title: c.title,
          department: c.department || '',
          industry: c.industry || '',
          notes: c.notes || '',
        }));
        const prompt = `你是專業的商務人脈分析師。請為以下 JSON 陣列中的每一筆名片資料，生成一段「精簡專業」的介紹文 (約 50-80 字，繁體中文)。\n【輸入資料】:\n${JSON.stringify(simplifiedData)}\n請回傳 JSON Array: [{"id": "對應ID", "summary": "介紹文"}]`;
        const response = await generateContentWithFallback(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { id: { type: Type.STRING }, summary: { type: Type.STRING } },
                required: ['id', 'summary'],
              },
            },
          },
        });
        const summaries = response.text ? JSON.parse(response.text) : [];
        return res.json({ success: true, summaries });
      }

      if (action === 'extractInfo') {
        const response = await generateContentWithFallback(ai, {
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              {
                text: `你是一位專業的商務名片資料分析專家，負責為 BizMind 智慧人脈系統提取全球名片資訊。請提取肉眼可見的資訊，並以 JSON 格式回傳。
【嚴格規則】：
1. **絕對忠於原圖**：僅提取名片上「肉眼可見」的文字資訊。若名片上沒有該資訊，請留空，嚴禁自行推測。
2. **語言處理**：
   - **英文/中文名片**：若名片包含英文，主要欄位請「優先提取英文」，對應中文填入 translations。若僅有中文，則提取中文。
   - **非中英名片**：若名片主要語言為非中文且非英文，請直接提取名片上的原文，並將繁體中文翻譯填入 translations。
3. **店家/通用名片**：若該圖片是店家、餐廳或企業的通用名片（無個人姓名），請將 firstName, lastName, title, prefix 留空 ("")，並將 category 設為 "other"。
4. **方向與旋轉容錯**：若名片呈現 90/180/270 度旋轉或為 A4 掃描局部，請自動多方向校正閱讀。
5. **國家/地區標準**：請將名片所屬國家轉換為標準英文名稱（例如台灣為 "Taiwan SAR"，中國為 "China Mainland"，香港為 "Hong Kong SAR"，澳門為 "Macau SAR"，美國為 "United States"，日本為 "Japan"）。
6. **多重資料提取規則**：
   - 電話 (Phone)：提取所有可見電話、手機、總機，多組用 " / " 分隔（不含傳真）。
   - 傳真 (Fax)：提取標示為 Fax 或傳真的號碼，多組用 " / " 分隔。
   - 電子郵件 (Email)：提取所有可見信箱，多組用 " / " 分隔。
7. **分類規則 (category)**：
   - "employer"：企業夥伴（一般私人企業、公司廠商、商業機構、社會企業代表）
   - "academic"：學研專家（大學教授、學者、研究員、講師、學術研究機構專家）
   - "staff"：機關社團（政府機關、公部門、非營利組織、基金會、協會學會或機構行政窗口）
   - "other"：一般聯絡人（無個人姓名的通用名片或其他個人聯絡資訊）
8. **AI 生成欄位**：
   - summary (名片簡介)：約 50-100 字繁體中文，流暢專業地介紹該聯絡人與所屬機構角色（缺少的資訊直接略過，絕不寫「未提供」）。
   - reasoning (分類依據)：繁體中文簡述歸類至該聯絡人分類的判斷理由。`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
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
                category: { type: Type.STRING, enum: ['employer', 'academic', 'staff', 'other'] },
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
                    country: { type: Type.STRING },
                  },
                },
              },
              required: [
                'firstName',
                'lastName',
                'title',
                'company',
                'category',
                'summary',
                'reasoning',
                'translations',
              ],
            },
          },
        });
        const data = response.text ? JSON.parse(response.text) : {};
        if (data.country) data.country = normalizeCountry(data.country);
        if (data.translations?.country) {
          data.translations.country = normalizeCountry(data.translations.country);
        }
        return res.json({ success: true, result: data });
      }

      if (action === 'detectCards') {
        const response = await generateContentWithFallback(ai, {
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              {
                text: "Identify the bounding boxes for each business card (or business card text cluster / contact information area) in this image. Note: 1) The image may be a scanned document (e.g. A4 flatbed scan) where the card has a white background with no distinct physical borders; in that case, detect the bounding box around the cluster of contact details/logo. 2) The card or text may be oriented horizontally or vertically (rotated 90, 180, or 270 degrees). Return JSON with 'boxes' array where coordinates are normalized integers or numbers from 0 to 1000.",
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                boxes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER },
                    },
                    required: ['ymin', 'xmin', 'ymax', 'xmax'],
                  },
                },
              },
            },
          },
        });
        const data = response.text ? JSON.parse(response.text) : { boxes: [] };
        return res.json({ success: true, boxes: data.boxes || [] });
      }

      if (action === 'extractBackInfo') {
        const frontSummary = JSON.stringify({
          prefix: card?.prefix || '',
          firstName: card?.firstName || '',
          lastName: card?.lastName || '',
          title: card?.title || '',
          company: card?.company || '',
          department: card?.department || '',
          industry: card?.industry || '',
          country: card?.country || '',
          email: card?.email || '',
          phone: card?.phone || '',
          fax: card?.fax || '',
          website: card?.website || '',
          address: card?.address || '',
          subject: card?.subject || '',
          translations: card?.translations || {},
        });

        let resolvedBase64 = image || '';
        let resolvedMimeType = mimeType || 'image/jpeg';

        if (!resolvedBase64 && imageUrl) {
          if (String(imageUrl).startsWith('data:image')) {
            resolvedMimeType = String(imageUrl).match(/data:(.*?);/)?.[1] || 'image/jpeg';
            resolvedBase64 = String(imageUrl).split(',')[1] || '';
          } else if (/^https?:\/\//i.test(String(imageUrl))) {
            const imgResp = await fetch(String(imageUrl));
            if (!imgResp.ok) {
              throw new Error(`無法讀取反面影像網址 (${imgResp.status})`);
            }
            const arrBuf = await imgResp.arrayBuffer();
            resolvedBase64 = Buffer.from(arrBuf).toString('base64');
            resolvedMimeType = imgResp.headers.get('content-type') || 'image/jpeg';
          }
        }

        if (!resolvedBase64) {
          return res.status(400).json({ success: false, error: '缺少名片反面影像資料' });
        }

        let recommendedBackRotation = Number(card?.backRotation || 0);
        try {
          const buf = Buffer.from(resolvedBase64, 'base64');
          const det = detectCardClockwiseRotation(buf, resolvedMimeType, recommendedBackRotation);
          if (det) {
            recommendedBackRotation = det.recommendedRotation;
          }
        } catch {
          // keep current rotation
        }

        const fieldsPropertiesSchema = {
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
          notes: { type: Type.STRING },
          translations: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              company: { type: Type.STRING },
              department: { type: Type.STRING },
              industry: { type: Type.STRING },
              subject: { type: Type.STRING },
              country: { type: Type.STRING },
            },
          },
        };

        const response = await generateContentWithFallback(ai, {
          contents: {
            parts: [
              { inlineData: { mimeType: resolvedMimeType, data: resolvedBase64 } },
              {
                text: `你是一位專業的雙面名片比對與資料擷取專家。使用者已提供名片「正面」既有資料，現在請分析這張「名片反面」影像（若呈現旋轉請自動轉正閱讀）：
【正面既有資料】：
${frontSummary}

【任務一：擷取反面獨立欄位 (backOnly)】：
1. 僅根據「反面影像肉眼可見文字」填入 backOnly。反面沒印的欄位請留空字串 ""，嚴禁把正面的資料抄進 backOnly。
2. 若反面同時印有英文與中文，backOnly 主欄位優先填英文，中文填入 backOnly.translations；若反面只有中文，將中文填入主欄位。
3. 若反面印有營業項目、服務說明或統編等資訊，整理至 backOnly.notes。
4. 國家標準化：台灣一律為 "Taiwan SAR"，中國為 "China Mainland"，香港為 "Hong Kong SAR"，澳門為 "Macau SAR"。

【任務二：判讀正反面關係與差異】：
- relationType：
  - "bilingual_mirror"：同一人、同一機構、同一職稱的中英對照版或反面僅為補充資訊。
  - "dual_role_same_person"：同一人但印有實質不同的職稱或兼任頭銜。
  - "different_entity"：正反面印有實質不同的公司／機構，或為不同聯絡人。
- conflictSummary：繁體中文簡短說明正反面的關係或差異重點。`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                relationType: {
                  type: Type.STRING,
                  enum: ['bilingual_mirror', 'dual_role_same_person', 'different_entity'],
                },
                hasDifferentTitle: { type: Type.BOOLEAN },
                hasDifferentOrg: { type: Type.BOOLEAN },
                hasDifferentPerson: { type: Type.BOOLEAN },
                conflictSummary: { type: Type.STRING },
                backOnly: {
                  type: Type.OBJECT,
                  properties: fieldsPropertiesSchema,
                  required: ['firstName', 'lastName', 'title', 'company', 'notes', 'translations'],
                },
              },
              required: [
                'relationType',
                'hasDifferentTitle',
                'hasDifferentOrg',
                'hasDifferentPerson',
                'conflictSummary',
                'backOnly',
              ],
            },
          },
        });

        const parsed = response.text ? JSON.parse(response.text) : {};
        if (parsed.backOnly) {
          if (parsed.backOnly.country) {
            parsed.backOnly.country = normalizeCountry(parsed.backOnly.country);
          }
          if (parsed.backOnly.translations?.country) {
            parsed.backOnly.translations.country = normalizeCountry(
              parsed.backOnly.translations.country
            );
          }
        }
        return res.json({
          success: true,
          result: {
            relationType: parsed.relationType || 'bilingual_mirror',
            hasDifferentTitle: Boolean(parsed.hasDifferentTitle),
            hasDifferentOrg: Boolean(parsed.hasDifferentOrg),
            hasDifferentPerson: Boolean(parsed.hasDifferentPerson),
            conflictSummary: parsed.conflictSummary || '',
            recommendedBackRotation,
            backOnly: parsed.backOnly || {},
          },
        });
      }

      if (action === 'generateFollowUpEmail') {
        const { emailOptions } = req.body;
        const toneMap: Record<string, string> = {
          business: '真誠得體的商務合作與專業問候',
          academic: '尊重專業的學術研究與顧問交流致意',
          event_followup: '活動或會議後親切溫暖的致謝與後續連結',
        };
        const langLabel =
          emailOptions?.language === 'en'
            ? '專業溫暖英文 (Warm & Professional English)'
            : '溫潤得體繁體中文 (Traditional Chinese)';
        const selectedTone = toneMap[emailOptions?.tone || 'business'] || toneMap.business;

        const prompt = `請根據以下名片聯絡人資訊，撰寫一封真誠、具體、有溫度且不流於罐頭套話的會後問候跟進信 (Follow-up Email)。

【收件人資訊】：
- 稱謂與姓名：${[card?.prefix, card?.firstName, card?.lastName].filter(Boolean).join(' ') || '合作夥伴'}
- 公司/機構：${card?.company || ''} ${card?.translations?.company ? `(${card.translations.company})` : ''}
- 職稱/部門：${card?.title || ''} ${card?.department ? `/ ${card.department}` : ''}
- 領域/產業：${card?.subject || card?.industry || ''}
- 認識場合/來源：${card?.source && card.source !== 'BizMind' ? card.source : '近期交流場合'}
- 名片簡介與備註：${card?.summary || ''} ${card?.notes ? `/ ${card.notes}` : ''}

【寄件設定】：
- 語氣風格：${selectedTone}
- 撰寫語言：${langLabel}
- 寄件人署名：${emailOptions?.senderName || '[您的姓名]'} ${emailOptions?.senderOrg ? `(${emailOptions.senderOrg})` : ''}
- 補充背景或目的：${emailOptions?.customContext || '表達很高興認識對方，肯定對方專業，並期待未來保持聯繫與合作'}

【輸出要求】：
請回傳 JSON 物件包含 subject (信件主旨) 與 body (信件內文，分段清晰，自然誠懇)。`;

        const response = await generateContentWithFallback(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                body: { type: Type.STRING },
              },
              required: ['subject', 'body'],
            },
          },
        });

        const draft = response.text ? JSON.parse(response.text) : { subject: '', body: '' };
        return res.json({ success: true, draft });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    } catch (e: any) {
      console.error('[SERVER_ERROR] analyze-card:', e);
      const rawMsg = e?.message || String(e);
      let userFriendlyError = rawMsg;
      if (
        rawMsg.includes('spending cap') ||
        rawMsg.includes('RESOURCE_EXHAUSTED') ||
        rawMsg.includes('429')
      ) {
        userFriendlyError = 'Google AI 配額已達上限，請稍後再試或檢查 API Key 配額設定。';
      } else if (rawMsg.includes('API key not valid') || rawMsg.includes('API_KEY_INVALID')) {
        userFriendlyError = 'Google Gemini API Key 無效或尚未設定，請確認環境變數 GEMINI_API_KEY。';
      }
      res.status(500).json({ success: false, error: userFriendlyError });
    }
  });

  // --- 3. API: Intent Extraction ---
  app.post('/api/chat/intent', heavyLimiter, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ success: false, error: 'Missing prompt' });

      const ai = getAiClient();
      const response = await generateContentWithFallback(ai, {
        contents: `分析使用者的對話意圖，並提取名片搜尋過濾條件。
使用者輸入：${prompt}

規則：
1. searchText: 使用者想搜尋的關鍵字（姓名、公司、職稱、領域等）。
2. category: 'all' | 'employer' (企業夥伴) | 'academic' (學研專家) | 'staff' (機關社團) | 'other' (一般聯絡人)。
3. country: 使用者想篩選的國家名稱（若有提到特定國家）。
4. requireEmail: 布林值，是否明確要求必須有 Email。
5. requirePhone: 布林值，是否明確要求必須有電話。
6. intentType: 'card_search' (搜尋特定對象) 或 'general_chat' (一般問答)。`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              searchText: { type: Type.STRING },
              category: {
                type: Type.STRING,
                enum: ['all', 'employer', 'academic', 'staff', 'other'],
              },
              country: { type: Type.STRING },
              requireEmail: { type: Type.BOOLEAN },
              requirePhone: { type: Type.BOOLEAN },
              intentType: {
                type: Type.STRING,
                enum: ['card_search', 'general_chat'],
              },
            },
            required: ['intentType'],
          },
        },
      });

      const intent = JSON.parse(response.text || '{}');
      res.json({ success: true, intent });
    } catch (e: any) {
      console.error('Intent Extraction Error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 4. API: AI Smart Contact Assistant ---
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, isSearchEnabled, cards } = req.body;
      if (!prompt) return res.status(400).json({ success: false, error: 'Missing prompt' });

      const ai = getAiClient();
      const config: any = {};
      if (isSearchEnabled) {
        config.tools = [{ googleSearch: {} }];
      }

      let systemInstruction =
        '你是 BizMind 智慧名片與人脈管理平台的專業 AI 助理，協助使用者檢索聯絡人、盤點合作夥伴並提供友善溝通建議。';

      const hasCards = cards && Array.isArray(cards) && cards.length > 0;
      if (hasCards) {
        const limitedCards = cards.slice(0, 35).map((c: any) => ({
          ID: c.id,
          姓名: `${c.lastName || ''}${c.firstName || ''}`,
          公司機構: c.company || '',
          職稱: c.title || '',
          產業領域: c.industry || c.subject || '',
          國家: c.country || '',
          Email: c.email || '',
          電話: c.phone || '',
          簡介: c.summary || '',
        }));

        systemInstruction += `\n\n【目前名片庫資料】（共載入 ${limitedCards.length} 筆）：\n${JSON.stringify(limitedCards)}\n\n`;
        if (isSearchEnabled) {
          systemInstruction +=
            '請優先參考名片庫回答，並搭配網路搜尋補充該機構或領域的最新公開資訊。若有對應聯絡人請將其 ID 與姓名放入 linkedCards。';
        } else {
          systemInstruction +=
            '請根據名片庫資料精確回答，若有對應聯絡人請將其 ID 與姓名放入 linkedCards。';
        }
      }

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          ...config,
          systemInstruction:
            systemInstruction +
            "\n\n請以 JSON 格式回答，包含 'reply' (回答文字) 與 'linkedCards' (符合的名片陣列，每項含 'id' 與 'name')。",
          responseMimeType: 'application/json',
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
                    name: { type: Type.STRING },
                  },
                  required: ['id', 'name'],
                },
              },
            },
            required: ['reply'],
          },
        },
      });

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const parsed = JSON.parse(response.text || '{}');
      const reply = parsed.reply || '';
      const linkedCards = parsed.linkedCards || [];

      let sources: { title: string; url: string }[] = [];
      if (groundingMetadata?.groundingChunks) {
        sources = groundingMetadata.groundingChunks
          .map((chunk: any) => ({
            title: chunk.web?.title || '參考來源',
            url: chunk.web?.uri || '',
          }))
          .filter((s: any) => s.url);
      }

      res.json({
        success: true,
        reply,
        sources,
        linkedCards,
      });
    } catch (e: any) {
      console.error('[SERVER_ERROR] chat:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // --- 5. Static / Vite Dev / Vercel Serverless Export ---
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      const vitePromise = import('vite').then(({ createServer }) =>
        createServer({
          server: { middlewareMode: true },
          appType: 'spa',
        })
      );
      app.use(async (req, res, next) => {
        try {
          const vite = await vitePromise;
          vite.middlewares(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    } else {
      const distPath = path.resolve('dist');
      app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
      app.use(express.static(distPath, { maxAge: '1h', index: false }));
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => console.log(`BizMind server running on port ${PORT}`));
  }

  return app;
}

export default startServer();
