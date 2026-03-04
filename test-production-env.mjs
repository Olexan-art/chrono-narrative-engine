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

async function testProductionEnvironment() {
  try {
    console.log('🔍 Testing production edge functions environment...\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const localServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('📋 Environment status:');
    console.log(`   URL: ${url ? '✅ SET' : '❌ MISSING'}`);
    console.log(`   Anon key: ${anonKey ? '✅ SET' : '❌ MISSING'}`);
    console.log(`   Local service key: ${localServiceKey ? '✅ SET (' + localServiceKey.length + ' chars)' : '❌ MISSING'}`);
    console.log('');
    
    // Test current production environment via admin function
    console.log('🧪 Testing production edge functions environment variables...');
    const adminUrl = `${url}/functions/v1/admin`;
    
    const testResponse = await fetch(adminUrl, {
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
          job_name: 'environment_test'
        }
      })
    });

    console.log(`📋 Production test: ${testResponse.status} ${testResponse.statusText}`);
    
    const testText = await testResponse.text();
    console.log(`📄 Response preview: ${testText.substring(0, 300)}`);
    
    try {
      const testResult = JSON.parse(testText);
      
      if (testResult.success) {
        console.log('\n✅ SUCCESS: Production edge functions have valid SERVICE_ROLE_KEY!');
        console.log('✅ Cron jobs should be working normally');
        console.log('🎉 All systems operational');
        
        // Check for recent logs
        await checkRecentLogs();
        
      } else if (testResult.body && testResult.body.code === 401) {
        console.log('\n❌ ISSUE: Production edge functions have invalid SERVICE_ROLE_KEY');
        console.log('🔧 ACTION NEEDED: Update production environment variables');
        console.log('\n📋 Manual setup required:');
        console.log('1. Install Supabase CLI: npm install -g supabase');
        console.log('2. Login to Supabase: supabase auth login');  
        console.log(`3. Set secret: supabase secrets set SUPABASE_SERVICE_ROLE_KEY="${localServiceKey}"`);
        console.log('');
        console.log('OR update via Supabase Dashboard:');
        console.log('1. Go to Project Settings → Edge Functions → Environment Variables');
        console.log(`2. Add: SUPABASE_SERVICE_ROLE_KEY = ${localServiceKey}`);
        console.log('3. Deploy changes');
        
      } else {
        console.log('\n⚠️  UNKNOWN: Edge functions responded but with unexpected result');
        console.log('Details:', testResult);
      }
      
    } catch (e) {
      console.log('\n⚠️  Could not parse response. Raw response:');
      console.log(testText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function checkRecentLogs() {
  try {
    console.log('\n📋 Checking recent cron execution logs...');
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5`;
    
    const logsResponse = await fetch(logsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (logsResponse.ok) {
      const logs = await logsResponse.json();
      if (Array.isArray(logs) && logs.length > 0) {
        console.log(`✅ Found ${logs.length} recent execution log(s):`);
        logs.forEach((log, i) => {
          const time = new Date(log.created_at).toLocaleString('uk-UA');
          const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
          console.log(`${i+1}. [${time}] ${status} ${log.job_name || 'unknown'} (${log.event_type})`);
        });
      } else {
        console.log('❌ No recent execution logs found');
        console.log('   This indicates cron jobs are not executing properly');
      }
    }
  } catch (error) {
    console.error('Error checking logs:', error.message);
  }
}

console.log('🚀 Chrono Narrative Engine - Production Environment Test\n');
testProductionEnvironment();