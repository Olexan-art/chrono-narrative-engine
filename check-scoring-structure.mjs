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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Детальна перевірка source_scoring результатів...\n');

// Fetch items with full source_scoring data
const response = await fetch(`${url}/rest/v1/news_rss_items?select=id,title,source_scoring&source_scoring=not.is.null&order=created_at.desc&limit=5`, {
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
});

if (response.ok) {
  const items = await response.json();
  if (items && items.length > 0) {
    console.log(`Знайдено ${items.length} оцінених новин:\n`);
    
    items.forEach((item, i) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`${i + 1}. ${item.title?.substring(0, 70)}...`);
      console.log(`   ID: ${item.id}\n`);
      
      if (item.source_scoring) {
        console.log('   📊 source_scoring структура:');
        console.log(JSON.stringify(item.source_scoring, null, 2));
        
        // Try different paths
        const json = item.source_scoring.json;
        const html = item.source_scoring.html;
        
        if (json) {
          console.log('\n   ✅ json знайдено:');
          console.log(`      - model: ${json.model || 'N/A'}`);
          console.log(`      - verification_status: ${json.verification_status || 'N/A'}`);
          
          if (json.verification_score) {
            console.log(`      - verification_score.overall: ${json.verification_score.overall || 'N/A'}`);
            console.log(`      - verification_score.authenticity: ${json.verification_score.authenticity || 'N/A'}`);
            console.log(`      - verification_score.bias: ${json.verification_score.bias || 'N/A'}`);
          } else {
            console.log('      ❌ verification_score відсутній!');
          }
        } else {
          console.log('\n   ❌ json відсутній в source_scoring!');
        }
        
        if (html) {
          console.log(`\n   ✅ html присутній (${html.length} символів)`);
        }
      } else {
        console.log('   ❌ source_scoring NULL');
      }
      console.log('');
    });
  } else {
    console.log('❌ Немає оцінених новин');
  }
} else {
  console.log(`❌ Помилка: ${response.status}`);
  console.log(await response.text());
}

// Check dashboard query
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 Перевірка специфічного запиту для dashboard:\n');

const dashQuery = await fetch(`${url}/rest/v1/news_rss_items?select=source_scoring&source_scoring=not.is.null&limit=3`, {
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
});

if (dashQuery.ok) {
  const data = await dashQuery.json();
  console.log('Відповідь від бази:');
  console.log(JSON.stringify(data, null, 2));
}
