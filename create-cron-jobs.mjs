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

function frequencyToCron(minutes) {
  if (minutes <= 5) return "*/5 * * * *";        // Every 5 minutes
  if (minutes <= 15) return "*/15 * * * *";      // Every 15 minutes  
  if (minutes <= 20) return "*/20 * * * *";      // Every 20 minutes
  if (minutes <= 30) return "*/30 * * * *";      // Every 30 minutes
  if (minutes <= 60) return "0 * * * *";         // Every hour
  if (minutes <= 90) return "0 */2 * * *";       // Every 2 hours
  if (minutes <= 120) return "0 */2 * * *";      // Every 2 hours  
  if (minutes <= 360) return "0 */6 * * *";      // Every 6 hours
  if (minutes <= 720) return "0 */12 * * *";     // Every 12 hours
  return "0 0 * * *";                            // Daily
}

async function createPgCronJobs() {
  try {
    console.log('🔧 Creating Missing pg_cron Jobs\n');
    console.log('===============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Get all enabled jobs from config
    console.log('1️⃣ Fetching active job configurations...');
    const configsUrl = `${url}/rest/v1/cron_job_configs?enabled=eq.true&select=*`;
    const configsResponse = await fetch(configsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (!configsResponse.ok) {
      throw new Error(`Failed to fetch configs: ${await configsResponse.text()}`);
    }
    
    const configs = await configsResponse.json();
    console.log(`✅ Found ${configs.length} enabled job(s) to create\n`);
    
    let created = 0;
    let failed = 0;
    
    for (const config of configs) {
      console.log(`⚙️ Processing: ${config.job_name}`);
      console.log(`   📅 Expected frequency: ${config.frequency_minutes} minutes`);
      
      // Convert frequency to cron expression
      const cronExpression = frequencyToCron(config.frequency_minutes);
      console.log(`   🕐 Cron expression: "${cronExpression}"`);
      
      // First update the config table with proper cron expression
      const updateConfigResponse = await fetch(`${url}/rest/v1/cron_job_configs?job_name=eq.${encodeURIComponent(config.job_name)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          cron_expression: cronExpression,
          is_active: true
        })
      });
      
      if (!updateConfigResponse.ok) {
        console.log(`   ❌ Failed to update config: ${await updateConfigResponse.text()}`);
        failed++;
        continue;
      }
      
      // Now create the job using updateCronConfig action
      const createResponse = await adminRequest('updateCronConfig', {
        jobName: config.job_name,
        config: {
          enabled: true,
          frequency_minutes: config.frequency_minutes,
          countries: config.countries,
          processing_options: config.processing_options
        }
      });
      
      if (createResponse.ok) {
        const result = await createResponse.text();
        console.log(`   ✅ Job created successfully`);
        created++;
      } else {
        const error = await createResponse.text();
        console.log(`   ❌ Failed to create job: ${error.substring(0, 100)}...`);
        failed++;
      }
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Created: ${created} jobs`);
    console.log(`❌ Failed: ${failed} jobs`);
    
    if (created > 0) {
      console.log(`\n🎉 SUCCESS! ${created} pg_cron jobs have been created.`);
      console.log(`⏰ Jobs will begin executing according to their schedules.`);
      console.log(`📊 Check execution logs in 5-15 minutes in cron_job_events table.`);
      
      console.log('\n📋 Verifying pg_cron jobs...');
      const verifyResponse = await adminRequest('inspectPgCron', { jobName: '%' });
      
      if (verifyResponse.ok) {
        const pgResult = await verifyResponse.json();
        console.log(`✅ Confirmed: ${pgResult.rows?.length || 0} job(s) now exist in pg_cron`);
        pgResult.rows?.forEach(job => {
          const nextRun = job.next_run ? new Date(job.next_run).toLocaleString('uk-UA') : 'calculating...';
          console.log(`   ⏰ ${job.jobname}: next run at ${nextRun}`);
        });
      }
    }
    
    if (failed > 0) {
      console.log(`\n⚠️ Some jobs failed to create. Check logs above for details.`);
    }
    
  } catch (error) {
    console.error('❌ Job creation failed:', error.message);
  }
}

console.log('🚀 pg_cron Job Creator');
console.log('======================\n');
createPgCronJobs();