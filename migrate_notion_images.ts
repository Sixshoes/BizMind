import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const SOURCE_PROP = process.env.NOTION_IMAGE_SOURCE_PROP || 'IMAGE_BASE64';
const TARGET_PROP = process.env.NOTION_IMAGE_TARGET_PROP || 'image_url';

const IS_DRY_RUN = !process.argv.includes('--apply');

async function migrate() {
  if (!API_KEY || !DATABASE_ID) {
    console.error("❌ Missing NOTION_API_KEY or NOTION_DATABASE_ID");
    process.exit(1);
  }

  console.log(`🚀 Starting Migration: ${SOURCE_PROP} -> ${TARGET_PROP}`);
  console.log(`📝 Mode: ${IS_DRY_RUN ? 'DRY-RUN (Scan only)' : 'LIVE (Applying changes)'}`);
  console.log("--------------------------------------------------");

  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  const failures: string[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  // Resolve Target Property Type by checking a sample page or the DB schema
  let targetType: 'url' | 'rich_text' = 'url'; // Defaulting to URL as per latest refactor

  try {
    // 1. Fetch DB Schema to detect target property type
    const dbResp = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    });
    const dbJson: any = await dbResp.json();
    if (dbResp.ok && dbJson.properties[TARGET_PROP]) {
      targetType = dbJson.properties[TARGET_PROP].type;
      console.log(`✅ Detected ${TARGET_PROP} type: ${targetType}`);
    } else {
      console.warn(`⚠️ Could not detect ${TARGET_PROP} type, defaulting to 'url'.`);
    }

    while (hasMore) {
      const resp = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_cursor: startCursor,
          page_size: 100
        })
      });

      const json: any = await resp.json();
      if (!resp.ok) throw new Error(json.message);

      for (const page of json.results) {
        scanned++;
        const p = page.properties;
        
        // Extract Source Value
        let sourceValue = '';
        const sourceObj = p[SOURCE_PROP];
        if (sourceObj) {
          if (sourceObj.type === 'url') sourceValue = sourceObj.url || '';
          else if (sourceObj.type === 'rich_text') sourceValue = sourceObj.rich_text.map((t: any) => t.plain_text).join('');
          else if (sourceObj.type === 'title') sourceValue = sourceObj.title.map((t: any) => t.plain_text).join('');
        }

        // Check Target Value
        let targetValue = '';
        const targetObj = p[TARGET_PROP];
        if (targetObj) {
          if (targetObj.type === 'url') targetValue = targetObj.url || '';
          else if (targetObj.type === 'rich_text') targetValue = targetObj.rich_text.map((t: any) => t.plain_text).join('');
        }

        if (sourceValue && !targetValue) {
          candidates++;
          
          if (!IS_DRY_RUN) {
            try {
              const updateBody: any = { properties: {} };
              if (targetType === 'url') {
                updateBody.properties[TARGET_PROP] = { url: sourceValue };
              } else {
                updateBody.properties[TARGET_PROP] = { 
                  rich_text: [{ text: { content: sourceValue } }] 
                };
              }

              const upResp = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${API_KEY}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateBody)
              });

              if (upResp.ok) {
                updated++;
                console.log(`✅ Migrated page ${page.id.substring(0, 8)}...`);
              } else {
                const err: any = await upResp.json();
                failures.push(`${page.id}: ${err.message}`);
                console.error(`❌ Failed page ${page.id.substring(0, 8)}: ${err.message}`);
              }
              
              // Rate limiting: Notion recommends 3 req/s
              await new Promise(r => setTimeout(r, 350));
            } catch (e: any) {
              failures.push(`${page.id}: ${e.message}`);
            }
          }
        }
      }

      hasMore = json.has_more;
      startCursor = json.next_cursor;
    }

    console.log("--------------------------------------------------");
    console.log(`🏁 Migration Completed`);
    console.log(`📊 Scanned: ${scanned}`);
    console.log(`🔍 Candidates (Source exists, Target empty): ${candidates}`);
    if (!IS_DRY_RUN) {
      console.log(`✨ Updated: ${updated}`);
      if (failures.length > 0) {
        console.log(`📉 Failures: ${failures.length}`);
        console.log("IDs:", failures.join(', '));
      }
    } else {
      console.log(`💡 Run with --apply to perform the actual update.`);
    }

  } catch (e: any) {
    console.error("❌ Fatal Error during migration:", e.message);
  }
}

migrate();
