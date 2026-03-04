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

async function createAllCronJobs() {
  try {
    console.log('🚀 FINAL CRON JOBS CREATOR');
    console.log('===========================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Test if columns exist now
    console.log('1️⃣ Testing table structure...');
    const testUrl = `${url}/rest/v1/cron_job_configs?select=job_name,cron_expression,is_active&limit=1`;
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (!testResponse.ok) {
      const error = await testResponse.text();
      console.log('❌ Table columns missing:', error);
      console.log('\n🔧 Please run this SQL in Supabase SQL Editor first:');
      console.log('');
      console.log('ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS cron_expression TEXT;');
      console.log('ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;');
      console.log('UPDATE cron_job_configs SET is_active = enabled WHERE is_active IS NULL;');
      console.log('');
      console.log('Then run this script again.');
      return;
    }
    
    console.log('✅ Table structure is ready\n');
    
    // Get all enabled jobs
    console.log('2️⃣ Getting enabled job configurations...');
    const configsUrl = `${url}/rest/v1/cron_job_configs?enabled=eq.true&select=*`;
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
    
    let created = 0;
    
    for (const config of configs) {
      console.log(`⚙️ ${config.job_name} (${config.frequency_minutes}min)`);
      
      const cronExpression = frequencyToCron(config.frequency_minutes);
      console.log(`   📅 Cron: "${cronExpression}"`);
      
      // Update config with cron expression
      const updateResponse = await fetch(`${url}/rest/v1/cron_job_configs?job_name=eq.${encodeURIComponent(config.job_name)}`, {
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
      
      if (!updateResponse.ok) {
        console.log(`   ❌ Failed to update config`);
        continue;
      }
      
      console.log(`   ✅ Config updated`);
      
      // Create pg_cron job via updateCronConfig
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
        console.log(`   ✅ pg_cron job CREATED`);
        created++;
      } else {
        const error = await createResponse.text();
        console.log(`   ❌ pg_cron creation failed: ${error.substring(0, 50)}...`);
      }
      
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n🎉 FINAL RESULT:`);
    console.log(`✅ Created ${created} pg_cron jobs`);
    
    if (created > 0) {
      console.log('\n📋 Verifying final state...');
      
      const verifyResponse = await adminRequest('inspectPgCron', { jobName: '%' });
      if (verifyResponse.ok) {
        const pgResult = await verifyResponse.json();
        console.log(`✅ Total pg_cron jobs: ${pgResult.rows?.length || 0}`);
        
        pgResult.rows?.forEach(job => {
          const nextRun = job.next_run ? new Date(job.next_run).toLocaleString('uk-UA') : 'pending';
          console.log(`   ⏰ ${job.jobname}: runs at ${nextRun}`);
        });
        
        console.log('\n🎊 SUCCESS! Cron system is now fully operational!');
        console.log('📊 Monitor execution logs in cron_job_events table.');
        console.log('⏰ First jobs should execute within 5-15 minutes.');
      }
    }
    
  } catch (error) {
    console.error('❌ Creation failed:', error.message);
  }
}

console.log('🚀 Complete Cron System Setup');
console.log('==============================\n');
createAllCronJobs();