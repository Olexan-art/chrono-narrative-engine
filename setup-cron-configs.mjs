import { createClient } from '@supabase/supabase-js';
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase env vars');
  process.exit(1);
}

// Try to use service role key if available
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey && fs.existsSync('.env.local')) {
  const envLocal = fs.readFileSync('.env.local', 'utf8');
  const match = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (match) {
    serviceRoleKey = match[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

// Use service role if available (bypasses RLS), otherwise use anon key
const supabase = createClient(SUPABASE_URL, serviceRoleKey || SUPABASE_KEY);

async function setupCronConfigs() {
  console.log('🔧 Setting up cron job configurations...\n');
  
  // First, let's see what exists
  console.log('1️⃣ Checking current configurations:');
  const { data: existing } = await supabase
    .from('cron_job_configs')
    .select('job_name, enabled, frequency_minutes');
  
  console.log(`   Found ${existing?.length || 0} existing configs\n`);
  
  // Define the cron jobs we need - using arrays as actual arrays, not JSON strings
  const cronJobs = [
    {
      job_name: 'news_fetching',
      enabled: true,
      frequency_minutes: 60,
      countries: ['all'],
      processing_options: null
    },
    {
      job_name: 'retell_recent_usa',
      enabled: true,
      frequency_minutes: 15,  // Updated from 30 to 15
      countries: ['us'],
      processing_options: {
        llm_model: 'gpt-4o-mini',
        llm_provider: 'openai',
        country_code: 'us',
        time_range: 'last_24h'
      }
    },
    {
      job_name: 'retell_india',
      enabled: false,  // Disabled
      frequency_minutes: 60,
      countries: ['in'],
      processing_options: {
        country_code: 'in',
        time_range: 'last_24h'
      }
    },
    {
      job_name: 'retell_india_deepseek',
      enabled: false,
      frequency_minutes: 90,
      countries: ['in'],
      processing_options: {
        llm_model: 'deepseek-chat',
        llm_provider: 'deepseek',
        country_code: 'in',
        time_range: 'last_24h'
      }
    },
    {
      job_name: 'retell_india_zai',
      enabled: false,
      frequency_minutes: 90,
      countries: ['in'],
      processing_options: {
        llm_model: 'GLM-4.7-Flash',
        llm_provider: 'zai',
        country_code: 'in',
        time_range: 'last_24h'
      }
    },
    {
      job_name: 'bulk_retell_all_deepseek',
      enabled: true,
      frequency_minutes: 180,
      countries: ['us', 'uk', 'br'],
      processing_options: {
        country_code: 'ALL',
        time_range: 'last_3h',
        llm_model: 'deepseek-chat',
        llm_provider: 'deepseek'
      }
    }
  ];
  
  console.log('2️⃣ Inserting/Updating cron configurations:\n');
  
  for (const job of cronJobs) {
    try {
      // Check if it exists
      const { data: exists, error: checkError } = await supabase
        .from('cron_job_configs')
        .select('id')
        .eq('job_name', job.job_name)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (exists) {
        // Update existing
        const { error } = await supabase
          .from('cron_job_configs')
          .update({
            enabled: job.enabled,
            frequency_minutes: job.frequency_minutes,
            countries: job.countries,
            processing_options: job.processing_options,
            updated_at: new Date().toISOString()
          })
          .eq('job_name', job.job_name);
        
        if (error) throw error;
        console.log(`   ✅ Updated: ${job.job_name}`);
      } else {
        // Insert new
        const { error } = await supabase
          .from('cron_job_configs')
          .insert({
            job_name: job.job_name,
            enabled: job.enabled,
            frequency_minutes: job.frequency_minutes,
            countries: job.countries,
            processing_options: job.processing_options,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
        console.log(`   ➕ Inserted: ${job.job_name}`);
      }
    } catch (err) {
      console.error(`   ❌ Failed ${job.job_name}: ${err.message}`);
    }
  }
  
  console.log('\n3️⃣ Verification - Current configurations:\n');
  const { data: final } = await supabase
    .from('cron_job_configs')
    .select('job_name, enabled, frequency_minutes, last_run_at')
    .order('job_name');
  
  if (final && final.length > 0) {
    final.forEach(cfg => {
      const status = cfg.enabled ? '✅' : '❌';
      const lastRun = cfg.last_run_at ? new Date(cfg.last_run_at).toLocaleString('uk-UA') : '⏳ Never run';
      console.log(`  ${status} ${cfg.job_name}: Every ${cfg.frequency_minutes}m (Last: ${lastRun})`);
    });
    
    console.log('\n✅ Cron configuration setup complete!\n');
    console.log('💡 Key changes:');
    console.log('  • retell_recent_usa: frequency set to 15 minutes (was 30)');
    console.log('  • retell_india, retell_india_deepseek, retell_india_zai: DISABLED');
    console.log('\n⏳ Waiting for next scheduled execution...');
    console.log('   Check cron_job_events table in 5-15 minutes for execution logs.\n');
  } else {
    console.log('❌ No configurations were saved. This may indicate:');
    console.log('  • Row-Level Security (RLS) is blocking inserts');
    console.log('  • Need service role key to bypass RLS');
    console.log('\n💡 If using Supabase dashboard, disable RLS or configure policies.');
  }
}

setupCronConfigs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
