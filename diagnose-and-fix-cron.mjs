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

async function adminRequest(action, data = null) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${url}/functions/v1/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({
      action,
      password: '1nuendo19071',
      data
    })
  });
  
  return response;
}

async function diagnoseCronSystem() {
  try {
    console.log('🔍 Complete Cron System Diagnosis\n');
    console.log('================================\n');
    
    // Step 1: Check what's in pg_cron
    console.log('1️⃣ Checking pg_cron jobs...');
    const pgCronResponse = await adminRequest('inspectPgCron', { jobName: '%' });
    
    if (pgCronResponse.ok) {
      const pgResult = await pgCronResponse.json();
      console.log(`📋 Found ${pgResult.rows?.length || 0} pg_cron job(s):`);
      pgResult.rows?.forEach(job => {
        const lastRun = job.last_run ? new Date(job.last_run).toLocaleString('uk-UA') : 'never';
        const nextRun = job.next_run ? new Date(job.next_run).toLocaleString('uk-UA') : 'unscheduled';
        console.log(`   ✨ ${job.jobname} (ID: ${job.jobid})`);
        console.log(`      📅 Schedule: "${job.schedule}"`);
        console.log(`      ⏰ Last: ${lastRun} | Next: ${nextRun}`); 
        console.log(`      ⚡ Active: ${job.active} | Status: ${job.last_status || 'none'}`);
      });
    } else {
      console.log(`❌ Could not inspect pg_cron: ${await pgCronResponse.text()}`);
    }
    
    console.log('\n2️⃣ Checking cron config table...');
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const configsUrl = `${url}/rest/v1/cron_job_configs?select=*&order=updated_at.desc`;
    const configsResponse = await fetch(configsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (configsResponse.ok) {
      const configs = await configsResponse.json();
      console.log(`📋 Found ${configs.length} config entry/entries:`);
      configs.forEach(config => {
        console.log(`   🔧 ${config.job_name}`);
        console.log(`      📅 Cron: "${config.cron_expression}"`); 
        console.log(`      ▶️ Active: ${config.is_active} | Enabled: ${config.enabled}`);
        console.log(`      ⏱️ Frequency: ${config.frequency_minutes}min`);
        console.log(`      🗺️ Countries: ${config.countries || 'default'}`);
      });
    }
    
    console.log('\n3️⃣ Testing direct job execution...');
    
    // Try to manually invoke one job to see what happens
    const testResponse = await adminRequest('testCronInvoke', {
      country_code: 'US',
      time_range: '3',
      job_name: 'retell_recent_usa'
    });
    
    const testResult = await testResponse.text();
    console.log(`📤 Manual test result: ${testResponse.status}`);
    console.log(`📄 Response: ${testResult.substring(0, 300)}...`);
    
    console.log('\n4️⃣ Checking execution logs...');
    const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5`;
    const logsResponse = await fetch(logsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (logsResponse.ok) {
      const logs = await logsResponse.json();
      if (logs.length > 0) {
        console.log(`📊 Latest ${logs.length} execution log(s):`);
        logs.forEach(log => {
          const time = new Date(log.created_at).toLocaleString('uk-UA');
          console.log(`   [${time}] ${log.job_name || 'unknown'} - ${log.event_type}`);
          if (log.details) {
            console.log(`      📝 Details: ${JSON.stringify(log.details).substring(0, 100)}...`);
          }
        });
      } else {
        console.log(`❌ No execution logs found (this is the problem!)`);
      }
    }
    
    console.log('\n🎯 DIAGNOSIS SUMMARY:');
    console.log('====================');
    
    if (pgResult?.rows?.length === 0) {
      console.log('❌ ISSUE FOUND: No jobs exist in pg_cron!');
      console.log('💡 SOLUTION: Need to CREATE pg_cron jobs from config table');
      console.log('\n📞 To fix this, we need to call updateCronConfig for each job...');
      
      // Try to fix by recreating one job
      if (configs.length > 0) {
        const firstJob = configs.find(c => c.is_active);
        if (firstJob) {
          console.log(`\n🔧 Attempting to fix by recreating "${firstJob.job_name}"...`);
          
          const fixResponse = await adminRequest('updateCronConfig', {
            jobName: firstJob.job_name,
            config: {
              enabled: firstJob.enabled,
              frequency_minutes: firstJob.frequency_minutes,
              countries: firstJob.countries,
              processing_options: firstJob.processing_options
            }
          });
          
          const fixResult = await fixResponse.text();
          console.log(`🔧 Fix attempt: ${fixResponse.status}`);
          console.log(`📄 Result: ${fixResult.substring(0, 200)}...`);
          
          if (fixResponse.ok) {
            console.log('✅ Job recreation successful! Try running diagnosis again in 1 minute.');
          }
        }
      }
      
    } else {
      console.log('✅ pg_cron jobs exist, issue may be elsewhere');
      if (testResponse.ok) {
        console.log('✅ Manual job execution works');
        console.log('🔍 Jobs should run automatically, check logs in 15-30 minutes');
      } else {
        console.log('❌ Manual job execution fails - authentication issue');
        console.log('💡 Check SUPABASE_SERVICE_ROLE_KEY environment variable');
      }
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

console.log('🚀 Cron System Diagnostic & Repair');
console.log('===================================\n');
diagnoseCronSystem();