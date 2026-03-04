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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function triggerCron() {
  try {
    console.log('🚀 Manually triggering bulk retell cron...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/bulk-retell-news`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        country_code: "us",
        time_range: "last_1h",
        job_name: "manual_test",
        trigger: "manual"
      })
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('📄 Raw response:', text.substring(0, 500));
    }
    
    if (response.ok) {
      console.log('\n✅ Successfully triggered manual execution!');
      console.log('\n⏳ Waiting 5 seconds then checking logs...');
      await new Promise(r => setTimeout(r, 5000));
      
      // Check for execution logs
      console.log('\n📋 Checking cron execution logs...');
      await checkLogs();
    } else {
      console.log('\n❌ Failed to trigger execution');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkLogs() {
  try {
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5';
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    const logs = await checkResponse.json();
    
    if (Array.isArray(logs) && logs.length > 0) {
      console.log(`✅ Found ${logs.length} recent execution log(s):`);
      logs.forEach((log, i) => {
        const time = new Date(log.created_at).toLocaleString('uk-UA');
        const status = log.status === 'success' ? '✅' : '❌';
        console.log(`${i+1}. [${time}] ${status} ${log.job_name || 'unknown'}`);
        if (log.rows_processed) console.log(`   → Processed ${log.rows_processed} rows`);
      });
    } else {
      console.log('❌ Still no execution logs found');
    }
  } catch (err) {
    console.error('Error checking logs:', err.message);
  }
}

triggerCron();