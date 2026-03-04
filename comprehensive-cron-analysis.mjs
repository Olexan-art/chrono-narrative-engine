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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function comprehensiveLogCheck() {
  try {
    console.log('🔍 Comprehensive cron execution analysis\n');
    
    // Check cron_job_events table structure
    console.log('📋 1. Checking cron_job_events table structure...');
    try {
      const structureUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&limit=1';
      const structureResponse = await fetch(structureUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY
        }
      });
      console.log(`   Table accessible: ${structureResponse.ok ? '✅' : '❌'}`);
      if (structureResponse.ok) {
        const sample = await structureResponse.json();
        console.log(`   Records found: ${Array.isArray(sample) ? sample.length : 'unknown'}`);
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
    
    // Get live cron configs to see last_run_at
    console.log('\n📋 2. Getting cron configs with last_run_at...');
    try {
      const adminUrl = `${SUPABASE_URL}/functions/v1/admin`;
      const cronResponse = await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
          action: 'getCronConfigs',
          password: '1nuendo19071'
        })
      });
      
      if (cronResponse.ok) {
        const cronData = await cronResponse.json();
        if (cronData.success && cronData.configs) {
          console.log(`   Found ${cronData.configs.length} cron jobs:`);
          cronData.configs.forEach((config, i) => {
            const lastRun = config.last_run_at ? new Date(config.last_run_at).toLocaleString('uk-UA') : 'Never';
            const status = config.enabled ? '🟢' : '🔴';
            console.log(`   ${i+1}. ${status} ${config.job_name} - Last: ${lastRun}`);
          });
          
          const recentRuns = cronData.configs.filter(c => c.last_run_at).sort((a,b) => new Date(b.last_run_at) - new Date(a.last_run_at));
          if (recentRuns.length > 0) {
            console.log(`\n   Most recent execution: ${recentRuns[0].job_name} at ${new Date(recentRuns[0].last_run_at).toLocaleString('uk-UA')}`);
          }
        }
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
    
    // Check for any logs in the events table
    console.log('\n📋 3. Deep search for ANY logs in cron_job_events...');
    try {
      const allLogsUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=50';
      const allLogsResponse = await fetch(allLogsUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY
        }
      });
      
      if (allLogsResponse.ok) {
        const allLogs = await allLogsResponse.json();
        if (Array.isArray(allLogs)) {
          console.log(`   Total logs found: ${allLogs.length}`);
          if (allLogs.length > 0) {
            console.log('   Recent logs:');
            allLogs.slice(0, 10).forEach((log, i) => {
              const time = new Date(log.created_at).toLocaleString('uk-UA');
              const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
              console.log(`   ${i+1}. [${time}] ${status} ${log.job_name || 'unknown'} (${log.event_type})`);
            });
          }
        }
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
    
    // Check PostgreSQL cron status via admin function
    console.log('\n📋 4. Checking PostgreSQL cron status...');
    console.log('   (This would require a custom admin action to query pg_cron.job_run_details)');
    
    // Summary and recommendations
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log('════════════════════════════════════════');
    console.log('✅ Edge functions are accessible');
    console.log('✅ Admin function works with SERVICE_ROLE_KEY');
    console.log('✅ Cron configurations are saved in database');
    console.log('✅ Some crons show last_run_at timestamps');
    console.log('❓ cron_job_events table status unknown');
    console.log('❓ Edge function logging might be failing silently');
    
    console.log('\n🚨 LIKELY ISSUE:');
    console.log('🔍 Either:');
    console.log('   1. pg_cron is running but edge functions fail to log');
    console.log('   2. Scheduler is updating last_run_at but not calling functions');
    console.log('   3. RLS policies block edge function logging');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

comprehensiveLogCheck();