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

async function finalVerification() {
  try {
    console.log('🎯 FINAL VERIFICATION AFTER SERVICE KEY UPDATE\n');
    console.log('===============================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Test the JWT issue directly
    console.log('1️⃣ Testing edge function authentication...');
    
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
    
    if (authTestResponse.ok) {
      const authResult = await authTestResponse.json();
      console.log('📋 Auth test result:', authResult);
      
      if (authResult.success && authResult.status === 200) {
        console.log('🎉 SUCCESS! JWT authentication is now working!');
        console.log('✅ Ready to create pg_cron jobs');
        
        console.log('\n2️⃣ Auto-creating pg_cron jobs now...');
        
        // Get all configs and recreate
        const configsUrl = `${url}/rest/v1/cron_job_configs?enabled=eq.true&select=*&limit=5`;
        const configsResponse = await fetch(configsUrl, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          }
        });
        
        if (configsResponse.ok) {
          const configs = await configsResponse.json();
          console.log(`📋 Recreating ${configs.length} job(s)...`);
          
          let created = 0;
          for (const config of configs) {
            console.log(`⚙️ ${config.job_name}...`);
            
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
              console.log(`   ✅ Created`);
              created++;
            } else {
              console.log(`   ❌ Failed`);
            }
          }
          
          if (created > 0) {
            console.log(`\n🔍 Verifying pg_cron jobs...`);
            
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
              console.log(`🎉 SUCCESS! ${jobCount} pg_cron jobs are now active!`);
              
              if (jobCount > 0) {
                verifyResult.rows.forEach(job => {
                  const next = job.next_run ? new Date(job.next_run).toLocaleString('uk-UA') : 'pending';
                  console.log(`   ⏰ ${job.jobname}: runs at ${next}`);
                });
                
                console.log('\n🎊 CRON SYSTEM IS FULLY OPERATIONAL!');
                console.log('📊 Monitor execution logs in cron_job_events table');
                console.log('⏰ Jobs will execute automatically according to schedule');
              }
            }
          }
        }
        
      } else {
        console.log(`❌ JWT still failing: ${authResult.status} - ${JSON.stringify(authResult.body)}`);
        console.log('💡 Please update SUPABASE_SERVICE_ROLE_KEY in Edge Functions settings');
      }
      
    } else {
      console.log(`❌ API test failed: ${authTestResponse.status}`);
      console.log(await authTestResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

console.log('🚀 Final System Verification');
console.log('============================\n');
finalVerification();