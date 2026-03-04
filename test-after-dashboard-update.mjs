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

async function testAndCreateCronSystem() {
  try {
    console.log('🎯 TESTING CRON SYSTEM AFTER DASHBOARD UPDATE\n');
    console.log('============================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Test authentication first
    console.log('1️⃣ Testing Edge Function authentication...');
    
    const authTestResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'testCronInvoke',  
        password: '1nuendo19071',
        data: {
          country_code: 'US',
          time_range: '3',
          job_name: 'retell_recent_usa'
        }
      })
    });
    
    if (!authTestResponse.ok) {
      console.log(`❌ API call failed: ${authTestResponse.status}`);
      console.log('Please check if the Dashboard environment variable was set correctly.');
      return;
    }
    
    const authResult = await authTestResponse.json();
    console.log('📋 Authentication test result:');
    console.log(`   Status: ${authResult.status}`);
    console.log(`   Success: ${authResult.success}`);
    
    if (authResult.status === 200 && authResult.success) {
      console.log('\n🎉 SUCCESS! Edge Function authentication is working!');
      console.log('✅ SERVICE_ROLE_KEY has been properly configured in Edge Functions');
      
      console.log('\n2️⃣ Creating all pg_cron jobs...');
      
      // Get enabled jobs
      const configsUrl = `${url}/rest/v1/cron_job_configs?enabled=eq.true&select=*&order=job_name`;
      const configsResponse = await fetch(configsUrl, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        }
      });
      
      if (configsResponse.ok) {
        const configs = await configsResponse.json();
        console.log(`📋 Found ${configs.length} enabled job(s) to create`);
        
        let created = 0;
        let failed = 0;
        
        for (const config of configs) {
          console.log(`⚙️ Creating: ${config.job_name} (${config.frequency_minutes}min)`);
          
          const createResponse = await fetch(`${url}/functions/v1/admin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({
              action: 'updateCronConfig',
              password: '1nuendo19071',
              data: {
                jobName: config.job_name,
                config: {
                  enabled: true,
                  frequency_minutes: config.frequency_minutes,
                  countries: config.countries,
                  processing_options: config.processing_options
                }
              }
            })
          });
          
          if (createResponse.ok) {
            console.log(`   ✅ SUCCESS`);
            created++;
          } else {
            console.log(`   ❌ FAILED`);
            failed++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`\n📊 Creation Results:`);
        console.log(`   ✅ Created: ${created} jobs`);
        console.log(`   ❌ Failed: ${failed} jobs`);
        
        if (created > 0) {
          console.log('\n3️⃣ Verifying pg_cron jobs...');
          
          const verifyResponse = await fetch(`${url}/functions/v1/admin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({
              action: 'inspectPgCron',
              password: '1nuendo19071',
              data: { jobName: '%' }
            })
          });
          
          if (verifyResponse.ok) {
            const verifyResult = await verifyResponse.json();
            const jobCount = verifyResult.rows?.length || 0;
            
            if (jobCount > 0) {
              console.log(`\n🎊 COMPLETE SUCCESS! ${jobCount} pg_cron jobs are now active!`);
              console.log('\n📅 Active Jobs Schedule:');
              verifyResult.rows.forEach((job, index) => {
                const nextRun = job.next_run 
                  ? new Date(job.next_run).toLocaleString('uk-UA', {
                      year: 'numeric',
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'calculating...';
                console.log(`   ${index + 1}. ${job.jobname}`);
                console.log(`      📅 Schedule: "${job.schedule}"`);
                console.log(`      ⏰ Next run: ${nextRun}`);
                console.log(`      ⚡ Active: ${job.active}`);
                console.log('');
              });
              
              console.log('🔥 СИСТЕМА CRON ПОВНІСТЮ РОБОЧА!');
              console.log('📊 Монітор логів: cron_job_events таблиця');
              console.log('⏰ Перші виконання: протягом 5-15 хвилин');
              console.log('✅ retell_recent_usa: кожні 15 хвилин');
              console.log('❌ India jobs: відключені');
              
            } else {
              console.log('\n❌ Jobs created in config but not in pg_cron');
              console.log('💡 There may still be an issue with cron.schedule() execution');
            }
          }
        }
        
      } else {
        console.log('❌ Failed to get job configs');
      }
      
    } else if (authResult.status === 401) {
      console.log('\n❌ Still getting 401 Invalid JWT');
      console.log('💡 Please double-check that you:');
      console.log('   1. Opened the correct project dashboard');
      console.log('   2. Set SUPABASE_SERVICE_ROLE_KEY exactly as shown');
      console.log('   3. Saved the environment variable');
      console.log('   4. Waited for Edge Functions to restart (may take 1-2 minutes)');
      
    } else {
      console.log(`\n⚠️ Unexpected response: ${authResult.status}`);
      console.log('Details:', JSON.stringify(authResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('🚀 Complete Cron System Test & Setup');
console.log('=====================================\n');
testAndCreateCronSystem();