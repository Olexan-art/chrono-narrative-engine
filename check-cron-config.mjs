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
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCronConfig() {
  console.log('🔍 Checking cron_configs table...\n');
  
  try {
    const { data, error } = await supabase
      .from('cron_configs')
      .select('*')
      .order('job_name', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching cron configs:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No cron configurations found.');
      return;
    }
    
    console.log(`📋 Found ${data.length} cron configurations:\n`);
    console.log('─'.repeat(140));
    
    data.forEach((config, index) => {
      const enabled = config.enabled ? '✅' : '❌';
      const lastRun = config.last_run_at 
        ? new Date(config.last_run_at).toLocaleString('uk-UA') 
        : '⏳ Never';
      const status = config.last_run_status || 'N/A';
      
      console.log(`\n${index + 1}. ${enabled} ${config.job_name}`);
      console.log(`   Frequency: Every ${config.frequency_minutes} minutes`);
      console.log(`   Countries: ${config.countries || 'N/A'}`);
      console.log(`   Last run: ${lastRun}`);
      console.log(`   Last status: ${status}`);
      if (config.processing_options) {
        console.log(`   Options: ${JSON.stringify(config.processing_options).substring(0, 80)}...`);
      }
    });
    
    console.log('\n' + '─'.repeat(140));
    
    // Count enabled vs disabled
    const enabled = data.filter(c => c.enabled).length;
    const disabled = data.filter(c => !c.enabled).length;
    console.log(`\n📊 Status: ${enabled} enabled, ${disabled} disabled`);
    
    // Check for jobs that should have run
    const now = new Date();
    console.log(`\n⏰ Current time: ${now.toLocaleString('uk-UA')}`);
    console.log('\nExpected next runs:');
    
    data.filter(c => c.enabled).forEach(config => {
      const lastRun = config.last_run_at ? new Date(config.last_run_at) : new Date(0);
      const nextRun = new Date(lastRun.getTime() + config.frequency_minutes * 60000);
      const diffMs = nextRun - now;
      const diffMinutes = Math.ceil(diffMs / 60000);
      
      if (diffMinutes <= 0) {
        console.log(`  🔴 ${config.job_name}: SHOULD RUN NOW (overdue by ${Math.abs(diffMinutes)} min)`);
      } else {
        console.log(`  🟡 ${config.job_name}: in ${diffMinutes} minutes`);
      }
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkCronConfig();
