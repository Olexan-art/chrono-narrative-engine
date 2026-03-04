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

async function testLoggingViaAdmin() {
  try {
    console.log('🧪 Testing logging via admin function...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'testLogging',
        data: {
          test_message: 'Test from manual script',
          timestamp: new Date().toISOString()
        }
      })
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 Response preview:', text.substring(0, 300));
    
    try {
      const result = JSON.parse(text);
      console.log('\n📊 Full parsed response:');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('\nCould not parse as JSON, raw response:');
      console.log(text);
    }
    
    // Check if log was written
    console.log('\n⏳ Waiting 3 seconds then checking for logs...');
    await new Promise(r => setTimeout(r, 3000));
    
    await checkForTestLogs();
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function checkForTestLogs() {
  try {
    console.log('\n📋 Checking for test logs...');
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&job_name=eq.test_logging&order=created_at.desc&limit=5';
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    if (!checkResponse.ok) {
      console.log(`❌ Failed to check logs: ${checkResponse.status}`);
      return;
    }
    
    const logs = await checkResponse.json();
    
    if (Array.isArray(logs) && logs.length > 0) {
      console.log(`✅ Found ${logs.length} test log(s):`);
      logs.forEach((log, i) => {
        const time = new Date(log.created_at).toLocaleString('uk-UA');
        console.log(`${i+1}. [${time}] ${log.event_type} - ${log.job_name}`);
        if (log.details) console.log(`   Details: ${JSON.stringify(log.details)}`);
      });
    } else {
      console.log('❌ No test logs found');
    }
    
  } catch (error) {
    console.error('Error checking logs:', error.message);
  }
}

testLoggingViaAdmin();