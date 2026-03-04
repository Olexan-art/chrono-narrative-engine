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

async function createWorkingCronJobs() {
  try {
    console.log('🔧 CREATING WORKING CRON JOBS\n');
    console.log('=============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Testing admin API first...');
    
    // Test admin API works
    const testResponse = await fetch(`${url}/functions/v1/admin`, {
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
    
    if (testResponse.ok) {
      console.log('✅ Admin API accessible');
    } else {
      console.log('❌ Admin API failed:', await testResponse.text());
      return;
    }
    
    console.log('\n2️⃣ Creating cron jobs using admin API...');
    
    // Create jobs that use admin API instead of direct service calls
    const workingJobs = [
      {
        name: 'retell_recent_usa_working',
        schedule: '*/15 * * * *',
        description: 'Retell recent USA news via admin API',
        command: `SELECT net.http_post(
          url := '${url}/functions/v1/admin',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := jsonb_build_object(
            'action', 'runBulkRetell',
            'password', '1nuendo19071',
            'data', jsonb_build_object(
              'country_code', 'US',
              'time_range', '3',
              'job_name', 'retell_recent_usa_working'
            )
          )::text,
          timeout := 60000
        )`
      },
      {
        name: 'news_fetching_working',
        schedule: '*/15 * * * *',
        description: 'Fetch RSS news via admin API',
        command: `SELECT net.http_post(
          url := '${url}/functions/v1/admin',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body := jsonb_build_object(
            'action', 'fetchRssNews',
            'password', '1nuendo19071',
            'data', jsonb_build_object('fetch_all', true)
          )::text,
          timeout := 60000
        )`
      }
    ];
    
    let created = 0;
    
    for (const job of workingJobs) {
      console.log(`⚙️ Creating: ${job.name}`);
      console.log(`   📅 Schedule: "${job.schedule}"`);
      
      try {
        // Remove existing job
        await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: `SELECT cron.unschedule('${job.name}')` })
        });
        
        // Create new job
        const createResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            sql: `SELECT cron.schedule('${job.name}', '${job.schedule}', $tag$${job.command}$tag$) as job_id`
          })
        });
        
        if (createResponse.ok) {
          const result = await createResponse.json();
          console.log(`   ✅ SUCCESS - Job ID: ${JSON.stringify(result)}`);
          created++;
          
          // Log creation
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
              event_type: 'scheduled_via_admin_api',
              origin: 'fix_script',
              details: { 
                schedule: job.schedule,
                uses_admin_api: true,
                description: job.description
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
    
    console.log(`📊 Created ${created}/${workingJobs.length} working jobs\n`);
    
    if (created > 0) {
      console.log('3️⃣ Testing manual execution...');
      
      // Test first job manually
      const firstJob = workingJobs[0];
      const testJobSql = `SELECT cron.run((SELECT jobid FROM cron.job WHERE jobname = '${firstJob.name}' LIMIT 1))`;
      
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
        console.log(`🧪 Manual test triggered for ${firstJob.name}`);
        
        console.log('⏳ Waiting 15 seconds for execution...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Check for logs
        const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=10`;
        const logsResponse = await fetch(logsUrl, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          }
        });
        
        if (logsResponse.ok) {
          const logs = await logsResponse.json();
          console.log(`📊 Found ${logs.length} recent log(s):`);
          logs.forEach((log, index) => {
            const time = new Date(log.created_at).toLocaleString('uk-UA');
            console.log(`${index + 1}. [${time}] ${log.job_name || 'unknown'} - ${log.event_type}`);
            if (log.details) {
              console.log(`   Details: ${JSON.stringify(log.details).substring(0, 150)}...`);
            }
            console.log('');
          });
          
          const recentExecutions = logs.filter(log => 
            log.event_type.includes('run') || log.event_type.includes('exec')
          );
          
          if (recentExecutions.length > 0) {
            console.log('🎉 SUCCESS! Jobs are executing and creating logs!');
            console.log('✅ Cron system is now working via admin API');
            console.log('📊 Monitor logs in cron_job_events table');
          } else {
            console.log('⚠️ No execution logs found yet');
            console.log('🔧 Jobs created but may need additional time');
          }
        }
      } else {
        console.log('❌ Manual test failed');
      }
      
      console.log('\n4️⃣ Summary:');
      console.log(`✅ Created ${created} working cron jobs using admin API`);
      console.log('🔑 These jobs use anon key + password authentication');
      console.log('🔄 Jobs should execute automatically every 15 minutes');
      console.log('📊 Monitor execution in cron_job_events table');
    }
    
  } catch (error) {
    console.error('❌ Creation failed:', error.message);
  }
}

console.log('🚀 Working Cron Jobs Creator');
console.log('============================\n');
createWorkingCronJobs();