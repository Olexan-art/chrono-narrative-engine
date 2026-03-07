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

async function applyMigration() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
    process.exit(1);
  }

  console.log('🚀 Applying multi-LLM source scoring crons migration\n');

  // Unschedule existing jobs
  const jobsToUnschedule = [
    'invoke_source_scoring_zai_30min',
    'invoke_source_scoring_gemini_hourly',
    'invoke_source_scoring_openai_3h'
  ];

  for (const jobName of jobsToUnschedule) {
    try {
      console.log(`🗑️ Unscheduling ${jobName}...`);
      const unscheduleSql = `SELECT cron.unschedule('${jobName}');`;
      const response = await fetch(`${url}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: unscheduleSql })
      });

      if (response.ok) {
        console.log(`✅ Unscheduled ${jobName}`);
      } else {
        console.log(`ℹ️ ${jobName} not found (OK)`);
      }
    } catch (err) {
      console.log(`ℹ️ ${jobName} unschedule skipped:`, err.message);
    }
  }

  // Create new cron jobs
  const cronJobs = [
    {
      name: 'invoke_source_scoring_zai_30min',
      schedule: '0,30 * * * *',
      provider: 'zai',
      model: 'GLM-4.7-Flash',
      description: 'Z.AI every 30 minutes (00, 30)'
    },
    {
      name: 'invoke_source_scoring_gemini_hourly',
      schedule: '15 * * * *',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      description: 'Gemini every hour at :15'
    },
    {
      name: 'invoke_source_scoring_openai_3h',
      schedule: '0 */3 * * *',
      provider: 'openai',
      model: 'gpt-4o-mini',
      description: 'OpenAI every 3 hours at :00'
    }
  ];

  for (const job of cronJobs) {
    try {
      console.log(`\n📅 Creating: ${job.description}`);
      console.log(`   Name: ${job.name}`);
      console.log(`   Schedule: ${job.schedule}`);
      console.log(`   Model: ${job.model}`);

      const cronCommand = `
        select net.http_post(
          url:='${url}/functions/v1/score-news-source',
          headers:='{"Content-Type":"application/json","Authorization":"Bearer ${serviceKey}"}'::jsonb,
          body:='{"auto_select":true,"model":"${job.model}","provider":"${job.provider}"}'::jsonb
        );
      `;

      const scheduleSql = `SELECT cron.schedule('${job.name}', '${job.schedule}', $$ ${cronCommand} $$);`;

      const response = await fetch(`${url}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: scheduleSql })
      });

      if (response.ok) {
        console.log(`✅ Created ${job.name}`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to create ${job.name}:`, error);
      }
    } catch (err) {
      console.error(`❌ Error creating ${job.name}:`, err.message);
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log('\n📊 Cron schedule summary:');
  console.log('  • Z.AI (glm-4-flash): Every 30 min at :00 and :30');
  console.log('  • Gemini (1.5-flash): Every hour at :15');
  console.log('  • DeepSeek (chat): Every hour at :30 (existing)');
  console.log('  • OpenAI (gpt-4o-mini): Every 3 hours at :00');
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
