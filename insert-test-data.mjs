import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY не встановлено');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function insertTestData() {
  const testData = [
    {
      job_name: 'retell_recent_usa',
      event_type: 'run_finished',
      origin: 'github',
      status: 'success',
      details: { provider: 'zai', llm_model: 'GLM-4.7-Flash', success_count: 15 },
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      job_name: 'retell_recent_usa',
      event_type: 'run_finished',
      origin: 'github',
      status: 'success',
      details: { provider: 'deepseek', llm_model: 'deepseek-chat', success_count: 12 },
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      job_name: 'retell_recent_usa',
      event_type: 'run_finished',
      origin: 'github',
      status: 'success',
      details: { provider: 'zai', llm_model: 'GLM-4.7-Flash', success_count: 18 },
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    },
    {
      job_name: 'retell_recent_usa',
      event_type: 'run_finished',
      origin: 'github',
      status: 'success',
      details: { provider: 'deepseek', llm_model: 'deepseek-chat', success_count: 14 },
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    }
  ];

  const { data, error } = await supabase
    .from('cron_job_events')
    .insert(testData);

  if (error) {
    console.error('❌ Error inserting test data:', error);
    process.exit(1);
  }

  console.log('✅ Test data inserted successfully!');
  console.log('📊 Inserted rows:', data?.length || testData.length);
}

insertTestData().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
