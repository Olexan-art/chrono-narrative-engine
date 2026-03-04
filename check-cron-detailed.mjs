import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getDetailedCronStatus() {
  console.log('📊 Detailed Cron Status Report\n');
  console.log('═'.repeat(100));
  
  // 1. Check cron_job_events table
  console.log('\n📋 CRON JOB EVENTS (Execution History):\n');
  try {
    const { data: events, error: eventsError, count } = await supabase
      .from('cron_job_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (eventsError) {
      console.log(`❌ Error fetching events: ${eventsError.message}`);
    } else {
      console.log(`Total records in cron_job_events: ${count}`);
      
      if (!events || events.length === 0) {
        console.log('\n⚠️  No execution logs found.');
        console.log('This means crons have NOT executed yet.\n');
      } else {
        console.log(`\nShowing latest ${events.length} events:\n`);
        events.forEach((evt, i) => {
          const time = new Date(evt.created_at).toLocaleString('uk-UA');
          console.log(`${i+1}. [${time}] ${evt.job_name || 'unknown'} - ${evt.status} (${evt.rows_processed || 0} rows)`);
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error querying cron_job_events: ${error.message}`);
  }
  
  // 2. Try to find config tables
  console.log('\n' + '─'.repeat(100));
  console.log('\n🔧 CRON CONFIGURATIONS:\n');
  
  const possibleTables = [
    'cron_configs',
    'cron_config',
    'cron_job_configs',
    'jobs_configs',
    'retell_crons'
  ];
  
  let foundConfigTable = null;
  
  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error && data) {
        foundConfigTable = tableName;
        console.log(`✅ Found config table: ${tableName}\n`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  
  if (foundConfigTable) {
    try {
      const { data: configs } = await supabase
        .from(foundConfigTable)
        .select('*')
        .order('job_name');
      
      if (configs && configs.length > 0) {
        console.log(`Found ${configs.length} cron configurations:\n`);
        configs.forEach(cfg => {
          const enabled = cfg.enabled ? '✅ Enabled' : '❌ Disabled';
          const freq = cfg.frequency_minutes ? `${cfg.frequency_minutes} min` : 'N/A';
          const lastRun = cfg.last_run_at ? new Date(cfg.last_run_at).toLocaleString('uk-UA') : 'Never';
          console.log(`  • ${cfg.job_name}: ${enabled} (Every ${freq}) - Last: ${lastRun}`);
        });
      }
    } catch (error) {
      console.error(`Error fetching configs: ${error.message}`);
    }
  } else {
    console.log('⚠️  Could not find cron config table.');
    console.log('Possible reasons:');
    console.log('  1. Configs are stored in a different location');
    console.log('  2. Table name is different than expected');
  }
  
  console.log('\n' + '═'.repeat(100));
  console.log('\n🎯 CONCLUSIONS:\n');
  console.log('If cron_job_events is empty:');
  console.log('  → Crons are NOT executing (scheduler may be inactive)');
  console.log('  → Check Supabase edge function logs for errors');
  console.log('  → Verify cron scheduler is enabled in Supabase');
  console.log('\n');
}

getDetailedCronStatus();
