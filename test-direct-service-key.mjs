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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testDirectServiceKey() {
  try {
    console.log('🧪 Testing direct service role key...\n');
    
    console.log('Environment check:');
    console.log('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('SERVICE_KEY present:', !!SERVICE_KEY);
    console.log('SERVICE_KEY preview:', SERVICE_KEY ? SERVICE_KEY.substring(0, 30) + '...' : 'NONE');
    console.log('');
    
    if (!SERVICE_KEY) {
      console.error('❌ SERVICE_KEY not loaded from .env');
      return;
    }
    
    // Test direct edge function call with local service key
    console.log('📤 Testing bulk-retell-news with local service key...');
    const url = `${SUPABASE_URL}/functions/v1/bulk-retell-news`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        country_code: 'us',
        time_range: 'last_1h',
        job_name: 'direct_test_service_key',
        trigger: 'manual'
      })
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 Response preview:', text.substring(0, 400));
    
    try {
      const result = JSON.parse(text);
      console.log('\n📊 Parsed result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (response.ok) {
        console.log('\n✅ Direct service key works!');
        console.log('✅ Edge function is accessible with valid service role key');
        console.log('❗ Issue is with edge functions environment variables in production');
        
        // Wait and check for logs
        console.log('\n⏳ Waiting 3 seconds to check for execution logs...');
        setTimeout(() => checkDirectTestLogs(), 3000);
      } else {
        console.log('\n❌ Direct service key failed');
        if (result.error) {
          console.log('Error details:', result.error);
        }
      }
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
  }
}

async function checkDirectTestLogs() {
  try {
    console.log('\n📋 Checking for direct test logs...');
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&job_name=eq.direct_test_service_key&order=created_at.desc&limit=3';
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      }
    });
    
    if (checkResponse.ok) {
      const logs = await checkResponse.json();
      if (Array.isArray(logs) && logs.length > 0) {
        console.log(`✅ Found ${logs.length} execution log(s):`);
        logs.forEach((log, i) => {
          const time = new Date(log.created_at).toLocaleString('uk-UA');
          console.log(`${i+1}. [${time}] ${log.event_type} - Status: ${log.status || 'unknown'}`);
          if (log.details) console.log(`   Details: ${JSON.stringify(log.details).substring(0, 100)}`);
        });
        console.log('\n🎉 SERVICE KEY WORKS! Edge functions can write logs!');
        console.log('🔧 Now need to update production edge functions environment variables');
      } else {
        console.log('❌ No logs found - edge function ran but may have logging issues');
      }
    } else {
      console.log(`❌ Failed to check logs: ${checkResponse.status}`);
      const errorText = await checkResponse.text();
      console.log('Error response:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('Error checking direct test logs:', error.message);
  }
}

testDirectServiceKey();