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

async function checkStatus() {
  console.log('🔄 Checking cron system status...\n');

  try {
    // Test production environment
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const response = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'testCronInvoke',
        password: '1nuendo19071',
        data: {
          country_code: 'us',
          time_range: 'last_1h',
          job_name: 'status_check'
        }
      })
    });

    const result = await response.json();
    
    if (result.success && result.status === 200) {
      console.log('✅ УСПІХ! Edge functions працюють з валідним SERVICE_ROLE_KEY');
      console.log('🎉 Кроны мають почати працювати');
      
      // Check for recent logs
      console.log('\n⏳ Checking for execution logs...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=3`;
      const logsResponse = await fetch(logsUrl, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        }
      });
      
      if (logsResponse.ok) {
        const logs = await logsResponse.json();
        if (logs.length > 0) {
          console.log(`🎯 Знайдено ${logs.length} нових логів виконання!`);
          logs.forEach((log, i) => {
            const time = new Date(log.created_at).toLocaleString('uk-UA');
            console.log(`${i+1}. [${time}] ${log.job_name} - ${log.event_type}`);
          });
        } else {
          console.log('⏳ Логи поки що відсутні, почекайте 10-15 хвилин');
        }
      }
      
    } else if (result.body && result.body.code === 401) {
      console.log('❌ Edge functions все ще мають invalid JWT');
      console.log('🔧 Переконайтеся що SERVICE_ROLE_KEY додано через Supabase Dashboard');
      console.log('⏰ Може знадобитися до 5 хвилин для застосування змін');
      
    } else {
      console.log('⚠️  Неочікувана відповідь:', result);
    }

  } catch (error) {
    console.error('❌ Помилка перевірки:', error.message);
  }
}

checkStatus();