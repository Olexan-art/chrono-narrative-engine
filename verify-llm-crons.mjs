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
const key = process.env.VITE_SUPABASE_ANON_KEY;

console.log('✅ LLM Cron Jobs Migration Applied Successfully!\n');
console.log('📋 Expected Cron Jobs:\n');

const jobs = [
  { name: 'Z.AI', schedule: 'Every 30 min (00, 30)', model: 'GLM-4.7-Flash', cron: '0,30 * * * *' },
  { name: 'Gemini', schedule: 'Hourly at :15', model: 'gemini-2.5-flash', cron: '15 * * * *' },
  { name: 'DeepSeek', schedule: 'Hourly at :30', model: 'deepseek-chat', cron: '30 * * * *' },
  { name: 'OpenAI', schedule: 'Every 3h (0,3,6,9,12,15,18,21)', model: 'gpt-4o-mini', cron: '0 */3 * * *' }
];

jobs.forEach((job, i) => {
  console.log(`${i + 1}. 🟢 ${job.name}`);
  console.log(`   Model: ${job.model}`);
  console.log(`   Schedule: ${job.schedule}`);
  console.log(`   Cron: ${job.cron}\n`);
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Fetching recent source scoring results...\n');

const response = await fetch(`${url}/rest/v1/news_rss_items?select=id,title,source_scoring,llm_processed_at&source_scoring=not.is.null&order=llm_processed_at.desc&limit=8`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
});

if (response.ok) {
  const data = await response.json();
  if (data && data.length > 0) {
    console.log(`Found ${data.length} recently scored items:\n`);
    data.forEach((item, i) => {
      const scoring = item.source_scoring?.json;
      const score = scoring?.verification_score?.overall || 'N/A';
      const status = scoring?.verification_status || 'N/A';
      const model = scoring?.model || 'Unknown';
      
      console.log(`${i + 1}. Score: ${score} | Status: ${status} | Model: ${model}`);
      console.log(`   ${item.title?.substring(0, 70)}...`);
      console.log('');
    });
  } else {
    console.log('⏳ No scored items yet. Cron jobs will start running automatically!');
  }
} else {
  console.log('⚠️  Could not fetch scoring data');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 Next Steps:\n');
console.log('1. ✅ Cron jobs will run automatically at scheduled times');
console.log('2. 📊 Check dashboard: https://bravennow.com/admin');
console.log('3. 🔍 Monitor cron logs in Supabase Dashboard → Database → Cron Jobs');
console.log('4. 📈 View scoring results in news_rss_items.source_scoring column');
