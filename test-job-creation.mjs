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

async function testJobCreation() {
  try {
    console.log('🔍 Testing Individual Job Creation Logic\n');
    console.log('=========================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Get one job to test each category
    const testJobs = [
      'news_fetching',        // should work (specific case)
      'cache_refresh',        // should work (specific case)  
      'bulk_retell_us',       // should work (startsWith bulk_retell_)
      'retell_recent_usa',    // should work (includes retell)
      'UK RSS Collection',    // should work (includes RSS) 
      'Flash News Translation', // should work (includes Translation)
      'LLM Usage Monitor',     // should work (includes Monitor)
      'Cache Cleanup'         // should work (includes Cleanup)
    ];
    
    for (const jobName of testJobs) {
      console.log(`🧪 Testing: ${jobName}`);
      
      // Get the job config
      const configUrl = `${url}/rest/v1/cron_job_configs?job_name=eq.${encodeURIComponent(jobName)}&select=*&limit=1`;
      const configResponse = await fetch(configUrl, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        }
      });
      
      if (configResponse.ok) {
        const configs = await configResponse.json();
        if (configs.length > 0) {
          const config = configs[0];
          console.log(`   📋 Config found: ${config.frequency_minutes}min, enabled: ${config.enabled}`);
          
          // Test updateCronConfig for this job
          console.log(`   🔧 Attempting to create pg_cron job...`);
          
          const createResponse = await adminRequest('updateCronConfig', {
            jobName: jobName,
            config: {
              enabled: true,
              frequency_minutes: config.frequency_minutes,
              countries: config.countries,
              processing_options: config.processing_options
            }
          });
          
          if (createResponse.ok) {
            console.log(`   ✅ updateCronConfig returned success`);
          } else {
            const error = await createResponse.text();
            console.log(`   ❌ updateCronConfig failed: ${error.substring(0, 100)}...`);
          }
        } else {
          console.log(`   ❌ No config found`);
        }
      } else {
        console.log(`   ❌ Failed to get config`);
      }
      
      // Check if job appeared in pg_cron
      const pgCheckResponse = await adminRequest('inspectPgCron', { jobName: jobName });
      if (pgCheckResponse.ok) {
        const pgResult = await pgCheckResponse.json();
        const foundJob = pgResult.rows?.find(row => row.jobname === jobName);
        if (foundJob) {
          console.log(`   🎯 FOUND in pg_cron: ${foundJob.schedule}`);
          console.log(`   ⏰ Next run: ${foundJob.next_run ? new Date(foundJob.next_run).toLocaleString('uk-UA') : 'unknown'}`);
        } else {
          console.log(`   ❌ NOT FOUND in pg_cron`);
        }
      }
      
      console.log('');
    }
    
    // Final summary
    console.log('📊 Final pg_cron verification...');
    const finalResponse = await adminRequest('inspectPgCron', { jobName: '%' });
    if (finalResponse.ok) {
      const finalResult = await finalResponse.json();
      console.log(`✅ Total pg_cron jobs: ${finalResult.rows?.length || 0}`);
      finalResult.rows?.forEach(job => {
        console.log(`   - ${job.jobname} (${job.schedule})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('🚀 Job Creation Logic Tester');
console.log('============================\n');
testJobCreation();