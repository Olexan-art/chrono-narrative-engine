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

async function simpleCronCreation() {
  try {
    console.log('🔧 SIMPLE pg_cron Creation via SQL\n');
    console.log('==================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';
    
    console.log('1️⃣ Testing SQL RPC access...');
    
    // Test basic SQL execution
    const testSql = "SELECT current_timestamp as test_time";
    const testResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: testSql })
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log('✅ SQL RPC works:', testResult);
    } else {
      console.log('❌ SQL RPC failed:', await testResponse.text());
      return;
    }
    
    console.log('\n2️⃣ Creating essential jobs manually...');
    
    // Define essential jobs with simple commands
    const jobs = [
      {
        name: 'retell_recent_usa',
        schedule: '*/15 * * * *',
        description: 'Retell recent USA news every 15 minutes',
        command: `SELECT net.http_post(url:='${url}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "US", "time_range": "3", "job_name": "retell_recent_usa", "trigger": "cron"}'::jsonb, timeout:=60000);`
      },
      {
        name: 'news_fetching',
        schedule: '*/15 * * * *',
        description: 'Fetch RSS news every 15 minutes',
        command: `SELECT net.http_post(url:='${url}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all"}'::jsonb, timeout:=60000);`
      },
      {
        name: 'news_retelling',
        schedule: '*/5 * * * *',
        description: 'Process retelling queue every 5 minutes',
        command: `SELECT net.http_post(url:='${url}/functions/v1/retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "process_queue"}'::jsonb, timeout:=60000);`
      },
      {
        name: 'cache_refresh',
        schedule: '0 * * * *',
        description: 'Refresh cache hourly',
        command: `SELECT net.http_post(url:='${url}/functions/v1/cache-pages', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "refresh-all"}'::jsonb, timeout:=60000);`
      }
    ];
    
    let created = 0;
    
    for (const job of jobs) {
      console.log(`⚙️ Creating: ${job.name}`);
      console.log(`   📅 Schedule: "${job.schedule}"`);
      console.log(`   📝 Description: ${job.description}`);
      
      try {
        // Clear existing job first
        const clearSql = `SELECT cron.unschedule('${job.name}')`;
        await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: clearSql })
        });
        
        // Create new job
        const createSql = `SELECT cron.schedule('${job.name}', '${job.schedule}', $tag$${job.command}$tag$) as job_id`;
        
        const createResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: createSql })
        });
        
        if (createResponse.ok) {
          const result = await createResponse.json();
          console.log(`   ✅ SUCCESS - Result: ${JSON.stringify(result)}`);
          created++;
          
          // Log creation event
          await fetch(`${url}/rest/v1/cron_job_events`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              job_name: job.name,
              event_type: 'scheduled_manual',
              origin: 'direct_sql',
              details: { 
                schedule: job.schedule, 
                method: 'manual_sql_rpc',
                command_length: job.command.length 
              }
            })
          });
          
        } else {
          const errorText = await createResponse.text();
          console.log(`   ❌ FAILED: ${errorText}`);
        }
        
      } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
      }
      
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 Creation Summary: ${created}/${jobs.length} jobs created\n`);
    
    if (created > 0) {
      console.log('3️⃣ Verifying pg_cron jobs...');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const verifySql = "SELECT jobid, jobname, schedule, next_run, active FROM cron.job ORDER BY jobname";
      
      const verifyResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: verifySql })
      });
      
      if (verifyResponse.ok) {
        const verifyResult = await verifyResponse.json();
        
        if (Array.isArray(verifyResult) && verifyResult.length > 0) {
          console.log(`🎉 SUCCESS! Found ${verifyResult.length} pg_cron job(s):`);
          verifyResult.forEach((job, index) => {
            const nextRun = job.next_run 
              ? new Date(job.next_run).toLocaleString('uk-UA')
              : 'calculating...';
            console.log(`   ${index + 1}. ${job.jobname} (ID: ${job.jobid})`);
            console.log(`      📅 Schedule: "${job.schedule}"`);
            console.log(`      ⏰ Next run: ${nextRun}`);
            console.log(`      ⚡ Active: ${job.active}`);
            console.log('');
          });
          
          console.log('🔥 CRON СИСТЕМА УСПІШНО СТВОРЕНА!');
          console.log('✅ retell_recent_usa: кожні 15 хвилин');
          console.log('✅ news_fetching: кожні 15 хвилин');  
          console.log('✅ news_retelling: кожні 5 хвилин');
          console.log('✅ cache_refresh: кожну годину');
          console.log('📊 Монітор логів: cron_job_events таблиця');
          console.log('⏰ Перші виконання: протягом 5-15 хвилин');
          
          // Test one job manually
          console.log('\n4️⃣ Testing manual job execution...');
          const testJobSql = `SELECT cron.run(${verifyResult[0].jobid}) as run_result`;
          
          const testJobResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: testJobSql })
          });
          
          if (testJobResponse.ok) {
            console.log(`🧪 Manual test triggered for ${verifyResult[0].jobname}`);
            console.log('📝 Check cron_job_events table for execution logs in 1-2 minutes');
          }
          
        } else {
          console.log('❌ No jobs found in verification');
          console.log('Raw result:', verifyResult);
        }
      } else {
        console.log('❌ Verification failed:', await verifyResponse.text());
      }
    }
    
  } catch (error) {
    console.error('❌ Simple creation failed:', error.message);
  }
}

console.log('🚀 Simple pg_cron Creation');
console.log('===========================\n');
simpleCronCreation();