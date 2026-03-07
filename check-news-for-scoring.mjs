import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('🔍 Checking for news items ready for scoring...\n');

try {
  const response = await fetch(`${url}/rest/v1/news_rss_items?select=id,title,slug,llm_processed_at&content=not.is.null&news_analysis=not.is.null&source_scoring=is.null&order=llm_processed_at.desc&limit=5`, {
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey
    }
  });

  if (!response.ok) {
    console.error('❌ Failed:', response.status, await response.text());
    process.exit(1);
  }

  const items = await response.json();
  
  console.log(`Found ${items.length} news items ready for scoring:\n`);
  
  items.forEach((item, i) => {
    console.log(`${i + 1}. ID: ${item.id}`);
    console.log(`   Title: ${item.title.substring(0, 80)}...`);
    console.log(`   Processed: ${item.llm_processed_at || 'N/A'}`);
    console.log('');
  });

  if (items.length === 0) {
    console.log('⚠️ No news items found with content + analysis but without scoring.');
    console.log('This might be why auto_select is failing.');
  } else {
    console.log(`✅ There are ${items.length} items available for auto-select scoring`);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
