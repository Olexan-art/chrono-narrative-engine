import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvents() {
  console.log('🔍 Перевірка cron_job_events таблиці...');

  // Загальна кількість подій
  const { data: allEvents, error: allError } = await supabase
    .from('cron_job_events')
    .select('count', { count: 'exact', head: true });

  if (allError) {
    console.error('❌ Помилка запиту:', allError);
    return;
  }

  console.log('📊 Загальна кількість подій:', allEvents);

  // Останні події (незалежно від типу)
  const { data: recentEvents, error: recentError } = await supabase
    .from('cron_job_events')
    .select('job_name, event_type, created_at, status, details')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Помилка отримання останніх подій:', recentError);
    return;
  }

  console.log('\n📋 Останні 10 подій:');
  if (recentEvents && recentEvents.length > 0) {
    recentEvents.forEach((ev, i) => {
      const time = new Date(ev.created_at).toLocaleString('uk-UA');
      console.log(`${i+1}. [${time}] ${ev.event_type} - ${ev.job_name || 'no job'} - ${ev.status || 'no status'}`);
    });
  } else {
    console.log('   ℹ️ Немає подій взагалі');
  }

  // Перевірка cron_job_configs
  const { data: configs, error: configError } = await supabase
    .from('cron_job_configs')
    .select('job_name, enabled, last_run_at, last_run_status, last_run_details')
    .order('last_run_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (configError) {
    console.error('❌ Помилка отримання конфігів:', configError);
    return;
  }

  console.log('\n⚙️ Cron job configs (останні запуски):');
  if (configs && configs.length > 0) {
    configs.forEach((cfg, i) => {
      const lastRun = cfg.last_run_at ? new Date(cfg.last_run_at).toLocaleString('uk-UA') : 'ніколи';
      console.log(`${i+1}. ${cfg.job_name} - enabled: ${cfg.enabled} - last: ${lastRun} - status: ${cfg.last_run_status || 'no status'}`);
    });
  } else {
    console.log('   ℹ️ Немає конфігурацій');
  }
}

checkEvents().catch(console.error);