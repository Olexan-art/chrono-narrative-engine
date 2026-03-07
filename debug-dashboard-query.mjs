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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for testing

console.log('🔍 Перевірка query який використовує dashboard...\n');

// Same query as dashboard
const response = await fetch(`${url}/rest/v1/news_rss_items?select=id,url,title,slug,source_scoring,updated_at,country:news_countries(code)&source_scoring=not.is.null&order=updated_at.desc&limit=5`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Accept': 'application/json'
  }
});

if (response.ok) {
  const data = await response.json();
  console.log(`Отримано ${data.length} записів\n`);
  
  data.forEach((item, i) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${i + 1}. ${item.title?.substring(0, 60)}...`);
    console.log(`   ID: ${item.id}\n`);
    
    console.log('   source_scoring type:', typeof item.source_scoring);
    
    if (item.source_scoring) {
      // Check if it's a JSON object or string
      if (typeof item.source_scoring === 'string') {
        console.log('   ⚠️  source_scoring is STRING, parsing...');
        const parsed = JSON.parse(item.source_scoring);
        console.log('   Parsed json exists:', !!parsed.json);
        console.log('   Parsed scores exists:', !!parsed.json?.scores);
        console.log('   Parsed scores.overall:', parsed.json?.scores?.overall);
      } else {
        console.log('   ✅ source_scoring is OBJECT');
        console.log('   json exists:', !!item.source_scoring.json);
        console.log('   scores exists:', !!item.source_scoring?.json?.scores);
        console.log('   scores.overall:', item.source_scoring?.json?.scores?.overall);
        
        // Show actual structure
        if (item.source_scoring.json) {
          const keys = Object.keys(item.source_scoring.json);
          console.log('   json keys:', keys.join(', '));
          
          if (item.source_scoring.json.scores) {
            console.log('   scores keys:', Object.keys(item.source_scoring.json.scores).join(', '));
          }
        }
      }
      
      // Try dashboard's exact path
      const overall = item.source_scoring?.json?.scores?.overall || 0;
      console.log(`\   🎯 Dashboard path result: ${overall}`);
    } else {
      console.log('   ❌ source_scoring is NULL/undefined');
    }
    console.log('');
  });
} else {
  console.log(`❌ Error: ${response.status}`);
  console.log(await response.text());
}
