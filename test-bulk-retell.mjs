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
  
  // Debug output
  console.log('🔧 Environment check:');
  console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET');
  console.log('KEY present:', !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  console.log('');
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Environment variables not properly loaded!');
  process.exit(1);
}

async function testBulkRetell() {
  try {
    console.log('🚀 Testing bulk-retell-news edge function...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/bulk-retell-news`;
    console.log('📍 URL:', url);
    
    const payload = {
      country_code: "us",
      time_range: "last_1h",
      job_name: "manual_test_bulk",
      trigger: "manual"
    };
    
    console.log('📤 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 Response body preview:', text.substring(0, 300));
    
    let result;
    try {
      result = JSON.parse(text);
      console.log('📊 Parsed response:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('📄 Full raw response:\n', text);
    }
    
    if (response.ok) {
      console.log('\n✅ Edge function responded successfully!');
      
      // Wait and check for execution logs
      console.log('\n⏳ Waiting 5 seconds then checking execution logs...');
      await new Promise(r => setTimeout(r, 5000));
      
      await checkExecutionLogs();
    } else {
      console.log('\n❌ Edge function returned error');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function checkExecutionLogs() {
  try {
    console.log('\n📋 Checking recent cron execution logs...');
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=10';
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    if (!checkResponse.ok) {
      console.log(`❌ Failed to fetch logs: ${checkResponse.status}`);
      return;
    }
    
    const logs = await checkResponse.json();
    
    if (Array.isArray(logs) && logs.length > 0) {
      console.log(`✅ Found ${logs.length} recent execution log(s):`);
      logs.forEach((log, i) => {
        const time = new Date(log.created_at).toLocaleString('uk-UA');
        const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
        console.log(`${i+1}. [${time}] ${status} ${log.job_name || 'unknown'} (${log.event_type})`);
        if (log.rows_processed) console.log(`   → Processed ${log.rows_processed} rows`);
        if (log.details) console.log(`   → Details: ${JSON.stringify(log.details)}`);
      });
    } else {
      console.log('❌ No execution logs found');
    }
    
  } catch (error) {
    console.error('Error checking execution logs:', error.message);
  }
}

testBulkRetell();