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

async function checkSupabaseEnvironment() {
  try {
    console.log('🔍 Checking Supabase environment configuration...\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('📋 Project details from .env:');
    console.log(`URL: ${url}`);
    console.log(`Project ID: ${url?.match(/https:\/\/([^.]+)/)?.[1] || 'unknown'}`);
    console.log(`Anon key prefix: ${anonKey?.substring(0, 30)}...`);
    console.log('');
    
    // Test if edge functions are working at all
    console.log('🧪 Testing basic admin function accessibility...');
    const adminResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'verify',
        password: '1nuendo19071'
      })
    });

    console.log(`📋 Admin function: ${adminResponse.status} ${adminResponse.statusText}`);
    
    if (adminResponse.ok) {
      const adminResult = await adminResponse.json();
      console.log(`✅ Admin function accessible: ${JSON.stringify(adminResult)}`);
      
      // Now check what service key the admin function sees
      console.log('\n🔑 Checking what service key the admin function has access to...');
      const keyCheckResponse = await fetch(`${url}/functions/v1/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          action: 'inspectPgCron',  // This will show if service key works
          password: '1nuendo19071',
          data: { jobName: '%' }
        })
      });
      
      const keyCheckText = await keyCheckResponse.text();
      console.log(`📋 Service key test: ${keyCheckResponse.status}`);
      console.log(`📄 Response: ${keyCheckText.substring(0, 200)}...`);
      
      try {
        const keyResult = JSON.parse(keyCheckText);
        if (keyResult.success === true) {
          console.log('\n✅ EDGE FUNCTIONS HAVE VALID SERVICE KEY!');
          console.log('🔧 The issue may be elsewhere - checking...');
          
          // Check if we can manually trigger a cron to create logs
          await testManualCronTrigger();
          
        } else {
          console.log('\n❌ Edge functions service key issue confirmed');
          console.log('🔧 Need to get correct service role key from Dashboard');
        }
      } catch (e) {
        console.log('Could not parse admin response');
      }
      
    } else {
      console.log('❌ Admin function not accessible');
      const errorText = await adminResponse.text();
      console.log(`Error: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Environment check failed:', error.message);
  }
}

async function testManualCronTrigger() {
  try {
    console.log('\n📤 Testing manual cron job trigger to create execution logs...');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const triggerResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'runPgCronNow',  // Force run a cron job
        password: '1nuendo19071',
        data: { 
          jobName: 'retell_recent_usa'  // Try to run this job manually
        }
      })
    });
    
    const triggerText = await triggerResponse.text();
    console.log(`📋 Manual trigger: ${triggerResponse.status}`);
    console.log(`📄 Result: ${triggerText}`);
    
    if (triggerResponse.ok) {
      console.log('\n⏳ Waiting 10 seconds for job to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check for new logs
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
          console.log(`🎉 SUCCESS! Found ${logs.length} execution log(s):`);
          logs.forEach(log => {
            const time = new Date(log.created_at).toLocaleString('uk-UA');
            console.log(`- [${time}] ${log.job_name} - ${log.event_type}`);
          });
          console.log('\n✅ Cron system is working! Jobs should execute automatically now.');
        } else {
          console.log('❌ No logs created yet - manual job may have failed');
        }
      }
    }
    
  } catch (error) {
    console.error('Manual trigger test failed:', error.message);
  }
}

console.log('🚀 Supabase Environment Diagnostic Tool');
console.log('======================================\n');
checkSupabaseEnvironment();