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

console.log('📊 Перевірка LLM логів використання...\n');

// Fetch recent LLM logs
const response = await fetch(`${url}/rest/v1/llm_usage_logs?select=*&order=created_at.desc&limit=10`, {
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
});

if (response.ok) {
  const logs = await response.json();
  if (logs && logs.length > 0) {
    console.log(`Знайдено ${logs.length} останніх записів:\n`);
    
    logs.forEach((log, i) => {
      const date = new Date(log.created_at);
      const time = date.toLocaleTimeString('uk-UA');
      const status = log.success ? '✅' : '❌';
      
      console.log(`${i + 1}. ${status} ${log.provider?.toUpperCase() || 'Unknown'} - ${log.operation}`);
      console.log(`   Час: ${time}`);
      console.log(`   Model: ${log.model || 'N/A'}`);
      console.log(`   Тривалість: ${log.duration_ms || 0}ms`);
      
      if (log.input_tokens || log.output_tokens) {
        console.log(`   Токени: ${log.input_tokens || 0} in / ${log.output_tokens || 0} out`);
      }
      
      if (!log.success && log.error_message) {
        console.log(`   ❌ Помилка: ${log.error_message.substring(0, 80)}...`);
      }
      
      console.log('');
    });
  } else {
    console.log('⚠️  Логів не знайдено');
  }
} else {
  console.log(`❌ Помилка отримання логів: ${response.status}`);
  console.log(await response.text());
}

// Check recent scoring results
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 Останні результати source scoring:\n');

const scoringResp = await fetch(`${url}/rest/v1/news_rss_items?select=id,title,source_scoring,llm_processed_at&source_scoring=not.is.null&order=llm_processed_at.desc&limit=5`, {
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
});

if (scoringResp.ok) {
  const items = await scoringResp.json();
  if (items && items.length > 0) {
    items.forEach((item, i) => {
      const scoring = item.source_scoring?.json;
      const score = scoring?.verification_score?.overall || 'N/A';
      const status = scoring?.verification_status || 'N/A';
      const model = scoring?.model || 'Unknown';
      
      console.log(`${i + 1}. Score: ${score} | Status: ${status} | Model: ${model}`);
      console.log(`   ${item.title?.substring(0, 70)}...`);
      console.log('');
    });
  } else {
    console.log('Немає оцінених новин');
  }
}
