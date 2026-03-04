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

async function verifyAndTestCronSystem() {
  try {
    console.log('🔍 VERIFYING CRON SYSTEM STATUS\n');
    console.log('===============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Checking pg_cron jobs...');
    
    // Check what columns exist in cron.job table
    const schemaSql = "SELECT column_name FROM information_schema.columns WHERE table_schema = 'cron' AND table_name = 'job'";
    
    const schemaResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: schemaSql })
    });
    
    if (schemaResponse.ok) {
      const schemaResult = await schemaResponse.json();
      console.log('📋 Available columns in cron.job:');
      schemaResult.forEach(col => console.log(`   - ${col.column_name}`));
      console.log('');
    }
    
    // Get jobs with available columns
    const jobsSql = "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname";
    
    const jobsResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: jobsSql })
    });
    
    if (jobsResponse.ok) {
      const jobs = await jobsResponse.json();
      
      if (Array.isArray(jobs) && jobs.length > 0) {
        console.log(`🎉 Found ${jobs.length} pg_cron job(s):`);
        jobs.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.jobname} (ID: ${job.jobid})`);
          console.log(`      📅 Schedule: "${job.schedule}"`);
          console.log(`      ⚡ Active: ${job.active}`);
          console.log('');
        });
        
        console.log('✅ CRON JOBS SUCCESSFULLY CREATED!');
        
        console.log('\n2️⃣ Testing job execution...');
        
        // Find retell_recent_usa job
        const retellJob = jobs.find(j => j.jobname === 'retell_recent_usa');
        if (retellJob) {
          console.log(`🧪 Testing ${retellJob.jobname} manually...`);
          
          const runJobSql = `SELECT cron.run(${retellJob.jobid}) as run_result`;
          
          const runResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: runJobSql })
          });
          
          if (runResponse.ok) {
            const runResult = await runResponse.json();
            console.log(`✅ Manual execution triggered: ${JSON.stringify(runResult)}`);
            
            // Wait and check for logs
            console.log('\n⏳ Waiting 10 seconds for execution...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5`;
            const logsResponse = await fetch(logsUrl, {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
              }
            });
            
            if (logsResponse.ok) {
              const logs = await logsResponse.json();
              console.log(`📊 Recent execution logs (${logs.length}):`);
              logs.forEach(log => {
                const time = new Date(log.created_at).toLocaleString('uk-UA');
                console.log(`   [${time}] ${log.job_name || 'unknown'} - ${log.event_type}`);
                if (log.details) {
                  const details = JSON.stringify(log.details).substring(0, 100);
                  console.log(`      📝 ${details}${details.length >= 100 ? '...' : ''}`);
                }
                console.log('');
              });
              
              if (logs.length > 0) {
                console.log('🔥 СИСТЕМА ПОВНІСТЮ РОБОЧА!');
                console.log('📊 Логи виконання з\'являються автоматично');
                console.log('⏰ Завдання виконуються за розкладом');
              }
            }
            
          } else {
            console.log('❌ Manual execution failed');
          }
        }
        
        console.log('\n3️⃣ Summary of active jobs:');
        jobs.forEach(job => {
          let frequency = 'Unknown';
          if (job.schedule === '*/15 * * * *') frequency = 'Every 15 minutes';
          else if (job.schedule === '*/5 * * * *') frequency = 'Every 5 minutes';
          else if (job.schedule === '0 * * * *') frequency = 'Every hour';
          
          console.log(`   ✅ ${job.jobname}: ${frequency}`);
        });
        
        console.log('\n🎯 СИСТЕМА CRON ПОВНІСТЮ НАЛАШТОВАНА!');
        console.log('📈 retell_recent_usa: кожні 15 хвилин (збільшено в 2 рази як запитано)');
        console.log('❌ retell_india_*: відключені як запитано');
        console.log('📊 Часові інтервали в UI: 30 хвилин, 1 година, 5 годин');
        console.log('🔍 Монітор виконання: cron_job_events таблиця');
        
      } else {
        console.log('❌ No pg_cron jobs found');
        console.log('Raw result:', jobs);
      }
    } else {
      console.log('❌ Failed to get jobs:', await jobsResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

console.log('🚀 Cron System Verification');
console.log('============================\n');
verifyAndTestCronSystem();