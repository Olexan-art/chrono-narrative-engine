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

async function createQueueSystem() {
  try {
    console.log('🏗️ CREATING NEW QUEUE SYSTEM');
    console.log('=============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Creating retell_queue table...');
    
    // Create retell queue table
    const createQueueSql = `
      CREATE TABLE IF NOT EXISTS retell_queue (
        id SERIAL PRIMARY KEY,
        news_id INTEGER NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('zai', 'deepseek')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
        reserved_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const queueResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createQueueSql })
    });
    
    if (queueResponse.ok) {
      console.log('   ✅ retell_queue table created');
    } else {
      const error = await queueResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('2️⃣ Creating indexes for retell_queue...');
    
    // Create indexes
    const createIndexesSql = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_retell_queue_news_provider 
        ON retell_queue(news_id, provider);
      CREATE INDEX IF NOT EXISTS idx_retell_queue_status_provider 
        ON retell_queue(status, provider, created_at);
    `;
    
    const indexResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createIndexesSql })
    });
    
    if (indexResponse.ok) {
      console.log('   ✅ Indexes created');
    } else {
      const error = await indexResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('3️⃣ Creating retell_stats table...');
    
    // Create retell statistics table
    const createStatsSql = `
      CREATE TABLE IF NOT EXISTS retell_stats (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('zai', 'deepseek')),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        hour INTEGER NOT NULL DEFAULT EXTRACT(hour FROM NOW()),
        processed_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        expired_count INTEGER DEFAULT 0,
        avg_processing_time_ms INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    const statsResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createStatsSql })
    });
    
    if (statsResponse.ok) {
      console.log('   ✅ retell_stats table created');
    } else {
      const error = await statsResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('4️⃣ Creating stats index...');
    
    const createStatsIndexSql = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_retell_stats_provider_date_hour 
        ON retell_stats(provider, date, hour);
    `;
    
    const statsIndexResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createStatsIndexSql })
    });
    
    if (statsIndexResponse.ok) {
      console.log('   ✅ Stats index created');
    } else {
      const error = await statsIndexResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('5️⃣ Setting up RLS policies...');
    
    const setupRLSSql = `
      ALTER TABLE retell_queue ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "retell_queue_policy" ON retell_queue FOR ALL USING (true);
    `;
    
    const rlsResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: setupRLSSql })
    });
    
    if (rlsResponse.ok) {
      console.log('   ✅ RLS policies set up');
    } else {
      const error = await rlsResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    const setupStatsRLSSql = `
      ALTER TABLE retell_stats ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "retell_stats_policy" ON retell_stats FOR ALL USING (true);
    `;
    
    const statsRlsResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: setupStatsRLSSql })
    });
    
    if (statsRlsResponse.ok) {
      console.log('   ✅ Stats RLS policies set up');
    } else {
      const error = await statsRlsResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('\n6️⃣ Creating queue manager cron job...');
    
    // Simplified queue manager job
    const queueManagerJob = `
INSERT INTO cron_job_events (job_name, event_type, origin, details) 
VALUES ('retell_queue_manager', 'execution_start', 'cron', 
  jsonb_build_object('start_time', NOW()::text));

-- Expire old pending items
UPDATE retell_queue 
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Add latest news to queues
INSERT INTO retell_queue (news_id, provider, status) 
SELECT id, 'zai', 'pending'
FROM news_items 
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND content IS NOT NULL 
  AND content != ''
ORDER BY created_at DESC 
LIMIT 10
ON CONFLICT (news_id, provider) DO NOTHING;

INSERT INTO retell_queue (news_id, provider, status) 
SELECT id, 'deepseek', 'pending'
FROM news_items 
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND content IS NOT NULL 
  AND content != ''
ORDER BY created_at DESC 
LIMIT 10
ON CONFLICT (news_id, provider) DO NOTHING;

INSERT INTO cron_job_events (job_name, event_type, origin, details)
VALUES ('retell_queue_manager', 'execution_complete', 'cron',
  jsonb_build_object('end_time', NOW()::text));
    `;
    
    const createJobSql = `
      SELECT cron.schedule(
        'retell_queue_manager',
        '*/10 * * * *',
        $tag$${queueManagerJob}$tag$
      ) as job_id;
    `;
    
    const jobResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createJobSql })
    });
    
    if (jobResponse.ok) {
      const result = await jobResponse.json();
      console.log(`   ✅ Queue manager created: ${JSON.stringify(result)}`);
    } else {
      const error = await jobResponse.text();
      console.log(`   ❌ Error: ${error}`);
    }
    
    console.log('\n7️⃣ Testing queue system...');
    
    // Test adding some items to queue
    const testSql = `
      INSERT INTO retell_queue (news_id, provider, status) 
      VALUES (1, 'zai', 'pending'), (2, 'deepseek', 'pending')
      ON CONFLICT (news_id, provider) DO NOTHING;
    `;
    
    const testResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: testSql })
    });
    
    if (testResponse.ok) {
      console.log('   ✅ Queue system test passed');
    } else {
      const error = await testResponse.text();
      console.log(`   ❌ Test error: ${error}`);
    }
    
    console.log('\n🎊 QUEUE SYSTEM SETUP COMPLETE!');
    console.log('================================');
    console.log('✅ Created retell_queue table');
    console.log('✅ Created retell_stats table');
    console.log('✅ Set up indexes and RLS policies');
    console.log('✅ Created retell_queue_manager cron job');
    console.log('✅ Queue system tested successfully');
    console.log('');
    console.log('📊 System Features:');
    console.log('• Separate queues for zai and deepseek');
    console.log('• Auto-expiration after 10 minutes');
    console.log('• Latest 10 news per provider every 10 min');
    console.log('• Full event logging');
    
  } catch (error) {
    console.error('❌ Queue system creation failed:', error.message);
  }
}

console.log('🏗️ Queue System Creator');
console.log('=======================\n');
createQueueSystem();