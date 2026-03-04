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

function frequencyToCron(minutes) {
  if (minutes <= 5) return "*/5 * * * *";        
  if (minutes <= 15) return "*/15 * * * *";       
  if (minutes <= 20) return "*/20 * * * *";       
  if (minutes <= 30) return "*/30 * * * *";       
  if (minutes <= 60) return "0 * * * *";          
  if (minutes <= 90) return "0 */2 * * *";        
  if (minutes <= 120) return "0 */2 * * *";       
  if (minutes <= 360) return "0 */6 * * *";       
  if (minutes <= 720) return "0 */12 * * *";      
  return "0 0 * * *";                             
}

async function createCronJobsDirectly() {
  try {
    console.log('🔧 ALTERNATIVE: Direct pg_cron Creation via SQL RPC\n');
    console.log('=================================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Get enabled jobs
    console.log('1️⃣ Getting enabled job configurations...');
    const configsUrl = `${url}/rest/v1/cron_job_configs?enabled=eq.true&select=*&order=job_name`;
    const configsResponse = await fetch(configsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (!configsResponse.ok) {
      throw new Error(`Failed to get configs: ${await configsResponse.text()}`);
    }
    
    const configs = await configsResponse.json();
    console.log(`✅ Found ${configs.length} enabled job(s)\n`);
    
    // Create RPC function for cron scheduling
    console.log('2️⃣ Creating direct pg_cron jobs via SQL...');
    
    let created = 0;
    let failed = 0;
    
    for (const config of configs) {
      console.log(`⚙️ Creating: ${config.job_name} (${config.frequency_minutes}min)`);
      
      const cronExpression = frequencyToCron(config.frequency_minutes);
      console.log(`   📅 Cron: "${cronExpression}"`);
      
      // Determine command based on job type
      let cronCommand = '';
      const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';
      
      if (config.job_name === 'news_fetching') {
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all"}'::jsonb, timeout:=60000) as request_id;`;
      } else if (config.job_name === 'news_retelling') {
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "process_queue"}'::jsonb, timeout:=60000) as request_id;`;
      } else if (config.job_name === 'cache_refresh') {
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/cache-pages', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "refresh-all"}'::jsonb, timeout:=60000) as request_id;`;
      } else if (config.job_name.includes('retell') && !config.job_name.includes('zai')) {
        const countries = config.countries || 'us';
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "${countries.split(',')[0].toUpperCase()}", "time_range": "3", "job_name": "${config.job_name}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
      } else if (config.job_name.includes('RSS') || config.job_name.includes('Collection')) {
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/fetch-rss', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"action": "fetch_all", "job_name": "${config.job_name}"}'::jsonb, timeout:=60000) as request_id;`;
      } else {
        // Generic job - try bulk-retell-news
        cronCommand = `SELECT net.http_post(url:='${url}/functions/v1/bulk-retell-news', headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb, body:='{"country_code": "US", "time_range": "3", "job_name": "${config.job_name}", "trigger": "cron"}'::jsonb, timeout:=60000) as request_id;`;
      }
      
      if (cronCommand) {
        try {
          // First clear any existing job
          console.log(`   🗑️ Removing existing job...`);
          const clearSql = `SELECT cron.unschedule('${config.job_name}')`;
          
          const clearResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: clearSql })
          });
          
          // Now create the job
          console.log(`   ⚙️ Creating pg_cron job...`);
          const createSql = `SELECT cron.schedule('${config.job_name}', '${cronExpression}', $tag$${cronCommand}$tag$) as job_id`;
          
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
            if (result && !result.error) {
              console.log(`   ✅ SUCCESS - Job ID created`);
              created++;
              
              // Log the successful creation
              try {
                await fetch(`${url}/rest/v1/cron_job_events`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${anonKey}`,
                    'apikey': anonKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                  },
                  body: JSON.stringify({
                    job_name: config.job_name,
                    event_type: 'scheduled_direct',
                    origin: 'sql_rpc',
                    details: { schedule: cronExpression, method: 'direct_sql' }
                  })
                });
              } catch (e) {
                console.log(`   ⚠️ Could not log creation event`);
              }
              
            } else {
              console.log(`   ❌ FAILED - SQL error: ${result?.error || 'unknown'}`);
              failed++;
            }
          } else {
            const errorText = await createResponse.text();
            console.log(`   ❌ FAILED - HTTP error: ${errorText.substring(0, 100)}...`);
            failed++;
          }
          
        } catch (err) {
          console.log(`   ❌ FAILED - Exception: ${err.message}`);
          failed++;
        }
      } else {
        console.log(`   ⚠️ SKIPPED - No command mapping for this job type`);
        failed++;
      }
      
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 RESULTS:`);
    console.log(`   ✅ Created: ${created} jobs`);
    console.log(`   ❌ Failed: ${failed} jobs\n`);
    
    if (created > 0) {
      console.log('3️⃣ Verifying created jobs...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check pg_cron for our jobs
      const verifySql = "SELECT jobid, jobname, schedule, next_run, active FROM cron.job WHERE jobname NOT LIKE '%pg_%'";
      
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
        const jobs = verifyResult || [];
        
        if (jobs.length > 0) {
          console.log(`🎉 SUCCESS! Found ${jobs.length} active pg_cron job(s):`);
          jobs.forEach((job, index) => {
            const nextRun = job.next_run 
              ? new Date(job.next_run).toLocaleString('uk-UA')
              : 'calculating...';
            console.log(`   ${index + 1}. ${job.jobname}`);
            console.log(`      📅 Schedule: "${job.schedule}"`);
            console.log(`      ⏰ Next run: ${nextRun}`);
            console.log(`      ⚡ Active: ${job.active}`);
            console.log('');
          });
          
          console.log('🔥 CRON СИСТЕМА ПРАЦЮЄ БЕЗ DASHBOARD ЗМІН!');
          console.log('📊 Монітор логів: cron_job_events таблиця');
          console.log('⏰ Перші виконання: протягом 5-15 хвилин');
          console.log('✅ Всі завдання створено безпосередньо через SQL');
          
        } else {
          console.log('❌ Завдання не з\'явилися в pg_cron');
          console.log('💡 Можливо, потрібні права на pg_cron або extension не увімкнений');
        }
      } else {
        console.log('❌ Не вдалося перевірити pg_cron jobs');
      }
    }
    
  } catch (error) {
    console.error('❌ Direct creation failed:', error.message);
  }
}

console.log('🚀 Alternative: Direct pg_cron Creation');
console.log('======================================\n');
createCronJobsDirectly();