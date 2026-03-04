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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function showCronStatus() {
  console.log('\n📊 CRON EXECUTION STATUS REPORT');
  console.log('═'.repeat(120));
  
  try {
    // Get cron configurations
    const { data: configs } = await supabase
      .from('cron_job_configs')
      .select('*')
      .order('job_name');
    
    if (!configs || configs.length === 0) {
      console.log('\n⚠️  No cron configurations found.');
      return;
    }
    
    console.log(`\n📋 CONFIGURED CRON JOBS (${configs.length} total):\n`);
    console.log('─'.repeat(120));
    
    const now = new Date();
    
    configs.forEach((cfg, idx) => {
      const statusIcon = cfg.enabled ? '🟢' : '🔴';
      const freqStr = cfg.frequency_minutes ? `${cfg.frequency_minutes}m` : 'N/A';
      
      let lastRunStr = '⏳ Never run';
      let nextRunStr = 'N/A';
      
      if (cfg.last_run_at) {
        const lastRun = new Date(cfg.last_run_at);
        lastRunStr = lastRun.toLocaleString('uk-UA');
        const nextRun = new Date(lastRun.getTime() + cfg.frequency_minutes * 60000);
        
        if (nextRun > now) {
          const diffMin = Math.ceil((nextRun - now) / 60000);
          nextRunStr = `in ${diffMin} min`;
        } else {
          const overdueMin = Math.ceil((now - nextRun) / 60000);
          nextRunStr = `🔴 OVERDUE ${overdueMin} min`;
        }
      } else {
        nextRunStr = 'Should run immediately';
      }
      
      console.log(`\n${idx + 1}. ${statusIcon} ${cfg.job_name}`);
      console.log(`   Frequency: Every ${freqStr}`);
      console.log(`   Enabled: ${cfg.enabled ? 'Yes ✅' : 'No ❌'}`);
      console.log(`   Last executed: ${lastRunStr}`);
      console.log(`   Next execution: ${nextRunStr}`);
      if (cfg.last_run_status) {
        const statusColor = cfg.last_run_status === 'success' ? '✅' : '❌';
        console.log(`   Last status: ${statusColor} ${cfg.last_run_status}`);
      }
    });
    
    console.log('\n' + '─'.repeat(120));
    
    // Get execution history
    console.log('\n📈 EXECUTION HISTORY:\n');
    const { data: events, count } = await supabase
      .from('cron_job_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(15);
    
    if (!events || events.length === 0) {
      console.log('❌ No execution history found.');
      console.log('\n⚠️  IMPORTANT: Crons are configured but have NEVER executed!');
      console.log('\nPossible causes:');
      console.log('  1. Scheduler process is not running');
      console.log('  2. Edge functions are not properly configured');
      console.log('  3. Cron timeout or trigger issue');
      console.log('\nAction needed:');
      console.log('  • Check Supabase Edge Functions logs');
      console.log('  • Verify scheduler process is active');
      console.log('  • Check for database permissions');
    } else {
      console.log(`Total executions: ${count}\n`);
      events.forEach((evt, i) => {
        const time = new Date(evt.created_at).toLocaleString('uk-UA');
        const status = evt.status === 'success' ? '✅' : '❌';
        console.log(`${i + 1}. [${time}] ${status} ${evt.job_name}`);
        if (evt.rows_processed) console.log(`   → Processed ${evt.rows_processed} rows`);
        if (evt.error_message) console.log(`   → Error: ${evt.error_message}`);
      });
    }
    
    console.log('\n' + '═'.repeat(120));
    
    // Summary
    const enabledCount = configs.filter(c => c.enabled).length;
    const withLastRun = configs.filter(c => c.last_run_at).length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  • Total jobs: ${configs.length}`);
    console.log(`  • Enabled: ${enabledCount}`);
    console.log(`  • Have executed: ${withLastRun}`);
    console.log(`  • Total execution events: ${count || 0}`);
    
    if (count === 0 && enabledCount > 0) {
      console.log(`\n🚨 ALERT: ${enabledCount} jobs are enabled but have never executed!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n');
}

showCronStatus();
