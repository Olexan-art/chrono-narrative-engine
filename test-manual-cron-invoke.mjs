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

async function testScheduleJob() {
  try {
    console.log('🧪 Testing manual pg_cron job scheduling...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    // First test a simple SQL execution
    console.log('1. Testing basic SQL execution via admin...');
    const testSqlResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: {
          jobName: '%'
        }
      })
    });

    const testSqlText = await testSqlResponse.text();
    console.log(`   SQL test result: ${testSqlText.substring(0, 200)}`);
    
    // Now try to manually create a simple test cron job
    console.log('\n2. Attempting to schedule a test cron job...');
    const cronResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'testCronInvoke',
        password: '1nuendo19071',
        data: {
          country_code: 'us',
          time_range: 'last_1h',
          job_name: 'manual_test_from_script'
        }
      })
    });

    console.log(`   Cron test status: ${cronResponse.status}`);
    const cronText = await cronResponse.text();
    console.log(`   Cron test result: ${cronText.substring(0, 300)}`);
    
    try {
      const cronResult = JSON.parse(cronText);
      console.log('\n📊 Cron test parsed:');
      console.log(JSON.stringify(cronResult, null, 2));
      
      if (cronResult.success) {
        console.log('\n✅ Manual invoke succeeded!');
        console.log('✅ Edge function bulk-retell-news is callable');
        console.log('❗ Issue is with pg_cron scheduler automation');
        
        // Check for logs after manual invoke
        setTimeout(() => checkManualInvokeLogs(), 3000);
      } else {
        console.log('\n❌ Manual invoke failed');
        console.log('❌ Edge function has issues or parameters wrong');
      }
    } catch (e) {
      console.log('Could not parse cron test result');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function checkManualInvokeLogs() {
  try {
    console.log('\n📋 Checking for logs after manual invoke...');
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&job_name=eq.manual_test_from_script&order=created_at.desc&limit=5';
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    if (checkResponse.ok) {
      const logs = await checkResponse.json();
      if (Array.isArray(logs) && logs.length > 0) {
        console.log(`✅ Found ${logs.length} log(s) from manual invoke:`);
        logs.forEach((log, i) => {
          const time = new Date(log.created_at).toLocaleString('uk-UA');
          console.log(`${i+1}. [${time}] ${log.event_type} - Status: ${log.status}`);
          if (log.details) console.log(`   Details: ${JSON.stringify(log.details)}`);
        });
      } else {
        console.log('❌ No logs found from manual invoke');
      }
    }
  } catch (error) {
    console.error('Error checking manual invoke logs:', error.message);
  }
}

testScheduleJob();