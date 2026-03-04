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

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCronLogs() {
  console.log('🔍 Checking cron_job_events table...\n');
  
  try {
    // Fetch the 15 most recent cron events
    const { data, error } = await supabase
      .from('cron_job_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    
    if (error) {
      console.error('❌ Error fetching cron logs:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No cron execution logs found in the table.');
      console.log('This could mean:');
      console.log('  1. No crons have executed yet');
      console.log('  2. Crons are not properly configured');
      console.log('  3. The scheduler is not running');
      return;
    }
    
    console.log(`📊 Found ${data.length} recent cron execution records:\n`);
    console.log('─'.repeat(120));
    
    data.forEach((event, index) => {
      const createdAt = new Date(event.created_at).toLocaleString('uk-UA');
      const status = event.status === 'success' ? '✅' : event.status === 'error' ? '❌' : '⏳';
      const jobName = event.job_name || 'unknown';
      const duration = event.duration_ms ? `${event.duration_ms}ms` : 'N/A';
      const errorMsg = event.error_message ? `\n    Error: ${event.error_message}` : '';
      
      console.log(`\n${index + 1}. ${status} ${jobName}`);
      console.log(`   Time: ${createdAt}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Rows processed: ${event.rows_processed || 0}`);
      if (errorMsg) {
        console.log(`   ${errorMsg}`);
      }
    });
    
    console.log('\n' + '─'.repeat(120));
    
    // Summary by job name
    const jobStats = {};
    data.forEach(event => {
      const job = event.job_name || 'unknown';
      if (!jobStats[job]) {
        jobStats[job] = { total: 0, success: 0, error: 0 };
      }
      jobStats[job].total++;
      if (event.status === 'success') jobStats[job].success++;
      if (event.status === 'error') jobStats[job].error++;
    });
    
    console.log('\n📈 Summary by job:\n');
    Object.entries(jobStats).forEach(([job, stats]) => {
      const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(0) : 0;
      console.log(`  ${job}: ${stats.total} total, ${stats.success} ✅, ${stats.error} ❌ (${successRate}% success)`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkCronLogs();
