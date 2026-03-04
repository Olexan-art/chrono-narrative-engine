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

async function freshCronSetup() {
  try {
    console.log('🚀 Fresh Cron System Setup');
    console.log('============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // 1. Clear ALL pg_cron jobs first
    console.log('1️⃣ Clearing existing pg_cron jobs...');
    const existingResponse = await adminRequest('inspectPgCron', { jobName: '%' });
    
    if (existingResponse.ok) {
      const pgResult = await existingResponse.json();
      console.log(`📋 Found ${pgResult.rows?.length || 0} existing pg_cron job(s)`);
      
      for (const job of (pgResult.rows || [])) {
        console.log(`   🗑️ Removing ${job.jobname}...`);
        // Clear via direct SQL
        try {
          await adminRequest('inspectPgCron', { 
            sql: `SELECT cron.unschedule('${job.jobname}')`
          });
          console.log(`   ✅ Removed ${job.jobname}`);
        } catch (e) {
          console.log(`   ⚠️ Failed to remove ${job.jobname}`);
        }
      }
    }
    
    // 2. Get fresh list of enabled jobs  
    console.log('\n2️⃣ Getting enabled job configurations...');
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
    
    // 3. Create each job individually
    let created = 0;
    let failed = 0;
    
    for (const config of configs) {
      console.log(`⚙️ Creating: ${config.job_name}`);
      console.log(`   ⏱️ Frequency: ${config.frequency_minutes} minutes`);
      
      const cronExpression = frequencyToCron(config.frequency_minutes);
      console.log(`   📅 Cron: "${cronExpression}"`);
      
      try {
        // Use updateCronConfig to create the job
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
          console.log(`   ✅ SUCCESS`);
          created++;
        } else {
          const error = await createResponse.text();
          console.log(`   ❌ FAILED: ${error.substring(0, 80)}...`);
          failed++;
        }
      } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
        failed++;
      }
      
      console.log('');
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`🏁 FINAL RESULTS:`);
    console.log(`✅ Created: ${created} jobs`);
    console.log(`❌ Failed: ${failed} jobs\n`);
    
    // 4. Verify final state
    if (created > 0) {
      console.log('🔍 Verifying final pg_cron state...');
      const verifyResponse = await adminRequest('inspectPgCron', { jobName: '%' });
      
      if (verifyResponse.ok) {
        const finalResult = await verifyResponse.json();
        console.log(`✅ Total active pg_cron jobs: ${finalResult.rows?.length || 0}`);
        
        finalResult.rows?.forEach((job, index) => {
          const nextRun = job.next_run ? new Date(job.next_run).toLocaleString('uk-UA') : 'calculating...';
          console.log(`   ${index + 1}. ${job.jobname}: next run at ${nextRun}`);
        });
        
        if (finalResult.rows?.length > 0) {
          console.log('\n🎉 SUCCESS! Cron system is operational!');
          console.log('📊 Monitor execution in cron_job_events table');
          console.log('⏰ First jobs should run within 5-15 minutes');
        } else {
          console.log('\n❌ No jobs created in pg_cron - check logs for errors');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Fresh setup failed:', error.message);
  }
}

console.log('🚀 Fresh Cron System Setup');
console.log('===========================\n');
freshCronSetup();