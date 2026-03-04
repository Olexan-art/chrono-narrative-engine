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

async function fixCronIntegration() {
  try {
    console.log('🔧 Fixing pg_cron integration...\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // First, check what's actually in pg_cron
    console.log('📋 1. Checking current pg_cron jobs...');
    const checkResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'listAllPgCronJobs',  // List ALL jobs in pg_cron
        password: '1nuendo19071'
      })
    });

    if (checkResponse.ok) {
      const checkResult = await checkResponse.json();
      console.log(`✅ Found ${checkResult.rows?.length || 0} pg_cron jobs:`);
      checkResult.rows?.forEach(job => {
        console.log(`- ${job.jobname}: "${job.schedule}" → ${job.command?.substring(0, 80)}...`);
      });
    } else {
      console.log(`❌ Could not check pg_cron: ${await checkResponse.text()}`);
    }
    
    console.log('\n📋 2. Getting configured jobs from database...');
    
    // Get all active jobs from our config table
    const configsUrl = `${url}/rest/v1/cron_job_configs?is_active=eq.true&select=*`;
    const configsResponse = await fetch(configsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (configsResponse.ok) {
      const configs = await configsResponse.json();
      console.log(`✅ Found ${configs.length} active config(s):`);
      
      configs.forEach(config => {
        console.log(`- ${config.job_name}: "${config.cron_expression}"`);
      });
      
      console.log('\n🔧 3. Recreating ALL pg_cron jobs...');
      
      // Recreate each job 
      for (const config of configs) {
        console.log(`\n⚙️ Processing ${config.job_name}...`);
        
        const recreateResponse = await fetch(`${url}/functions/v1/admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`
          },
          body: JSON.stringify({
            action: 'recreatePgCronJob',
            password: '1nuendo19071',
            data: {
              jobName: config.job_name,
              schedule: config.cron_expression,
              command: `SELECT cron.schedule_in_database('${config.job_name}', '${config.cron_expression}', $tag$
                INSERT INTO cron_job_events (job_name, event_type, details) 
                VALUES ('${config.job_name}', 'started', 'Automated execution started');
                
                SELECT net.http_post(
                  '${url}/functions/v1/admin',
                  payload := jsonb_build_object(
                    'action', 'executeJob',
                    'password', '1nuendo19071',
                    'jobName', '${config.job_name}'
                  )::text,
                  headers := jsonb_build_object(
                    'Content-Type', 'application/json'
                  )
                );
                
                INSERT INTO cron_job_events (job_name, event_type) 
                VALUES ('${config.job_name}', 'completed');
              $tag$);`
            }
          })
        });
        
        const recreateText = await recreateResponse.text();
        if (recreateResponse.ok) {
          try {
            const result = JSON.parse(recreateText);
            if (result.success) {
              console.log(`✅ ${config.job_name} recreated successfully`);
            } else {
              console.log(`⚠️ ${config.job_name} recreation issue: ${result.error || 'unknown'}`);
            }
          } catch {
            console.log(`✅ ${config.job_name} processed (non-JSON response)`);
          }
        } else {
          console.log(`❌ ${config.job_name} failed: ${recreateText}`);
        }
        
        // Small delay between jobs
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('\n📋 4. Verifying final pg_cron state...');
      
      const finalCheckResponse = await fetch(`${url}/functions/v1/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          action: 'listAllPgCronJobs',
          password: '1nuendo19071'
        })
      });

      if (finalCheckResponse.ok) {
        const finalResult = await finalCheckResponse.json();
        console.log(`\n🎉 Final state: ${finalResult.rows?.length || 0} active pg_cron jobs`);
        finalResult.rows?.forEach(job => {
          console.log(`✅ ${job.jobname}: active and scheduled`);
        });
        
        if (finalResult.rows?.length > 0) {
          console.log('\n⏰ Jobs should start executing within their scheduled intervals!');
          console.log('📊 Monitor execution at: cron_job_events table');
        }
      }
      
    } else {
      console.log(`❌ Could not get configs: ${await configsResponse.text()}`);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  }
}

console.log('🚀 Cron Integration Repair Tool');
console.log('================================\n');
fixCronIntegration();