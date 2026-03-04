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

async function cleanupOldCrons() {
  try {
    console.log('🧹 CLEANING UP OLD CRON SYSTEM');
    console.log('===============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Removing all existing pg_cron jobs...');
    
    // List of all cron job names to remove
    const cronJobsToRemove = [
      'retell_recent_usa',
      'retell_recent_usa_final', 
      'retell_usa_final',
      'retell_usa_working_final',
      'retell_usa_ultra_simple',
      'retell_usa_trigger',
      'retell_usa_production',
      'cron_heartbeat',
      'simple_test_logger',
      'bulk_retell_all_deepseek',
      'bulk_retell_all_zai',
      'invoke_bulk_retell_news_deepseek_15m',
      'invoke_bulk_retell_news_zai_15m',
      'news_fetching_working',
      'retell_recent_usa_working'
    ];
    
    let removedCount = 0;
    
    for (const jobName of cronJobsToRemove) {
      console.log(`   🗑️ Removing: ${jobName}`);
      
      const removeSql = `SELECT cron.unschedule('${jobName}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${jobName}');`;
      
      try {
        const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: removeSql })
        });
        
        if (response.ok) {
          removedCount++;
        }
      } catch (err) {
        console.log(`      ❌ Error removing ${jobName}: ${err.message}`);
      }
    }
    
    console.log(`   ✅ Processed ${removedCount}/${cronJobsToRemove.length} job removals`);
    
    console.log('\n2️⃣ Cleaning cron_job_configs...');
    
    // Remove old cron configs
    const configsToRemove = [
      'retell_recent_usa',
      'bulk_retell_all_deepseek',
      'bulk_retell_all_zai'
    ];
    
    let configsRemoved = 0;
    
    for (const configName of configsToRemove) {
      console.log(`   🗑️ Removing config: ${configName}`);
      
      try {
        const response = await fetch(`${url}/rest/v1/cron_job_configs?job_name=eq.${configName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          configsRemoved++;
        }
      } catch (err) {
        console.log(`      ❌ Error removing config ${configName}: ${err.message}`);
      }
    }
    
    console.log(`   ✅ Removed ${configsRemoved}/${configsToRemove.length} config entries`);
    
    console.log('\n3️⃣ Cleaning old cron_job_events...');
    
    // Clean old events (keep last 100 but remove bulk retell events)
    const cleanEventsSql = `
      DELETE FROM cron_job_events 
      WHERE job_name IN (
        'retell_recent_usa', 'retell_recent_usa_final', 'retell_usa_final',
        'retell_usa_working_final', 'bulk_retell_all_deepseek', 'bulk_retell_all_zai'
      )
      AND created_at < NOW() - INTERVAL '1 hour';
    `;
    
    const cleanResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: cleanEventsSql })
    });
    
    if (cleanResponse.ok) {
      console.log('   ✅ Cleaned old event logs');
    } else {
      console.log('   ❌ Error cleaning event logs');
    }
    
    console.log('\n4️⃣ Creating new queue system tables...');
    
    // Create retell queue tables
    const createQueueTablesSql = `
      -- Create retell queue table
      CREATE TABLE IF NOT EXISTS retell_queue (
        id SERIAL PRIMARY KEY,
        news_id INTEGER NOT NULL REFERENCES news_items(id),
        provider TEXT NOT NULL CHECK (provider IN ('zai', 'deepseek')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
        reserved_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Create unique index to prevent duplicate entries
      CREATE UNIQUE INDEX IF NOT EXISTS idx_retell_queue_news_provider 
        ON retell_queue(news_id, provider);
      
      -- Create index for efficient queries
      CREATE INDEX IF NOT EXISTS idx_retell_queue_status_provider 
        ON retell_queue(status, provider, created_at);
      
      -- Create retell statistics table
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
      
      -- Create unique index for stats
      CREATE UNIQUE INDEX IF NOT EXISTS idx_retell_stats_provider_date_hour 
        ON retell_stats(provider, date, hour);
      
      -- Enable RLS
      ALTER TABLE retell_queue ENABLE ROW LEVEL SECURITY;
      ALTER TABLE retell_stats ENABLE ROW LEVEL SECURITY;
      
      -- Create policies
      CREATE POLICY IF NOT EXISTS "retell_queue_policy" ON retell_queue FOR ALL USING (true);
      CREATE POLICY IF NOT EXISTS "retell_stats_policy" ON retell_stats FOR ALL USING (true);
    `;
    
    const createResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createQueueTablesSql })
    });
    
    if (createResponse.ok) {
      console.log('   ✅ Created new queue and stats tables');
    } else {
      const error = await createResponse.text();
      console.log(`   ❌ Error creating tables: ${error}`);
    }
    
    console.log('\n5️⃣ Creating new queue management cron job...');
    
    // Create the new queue manager cron
    const queueManagerJob = `
      DO $$
      DECLARE
        news_record RECORD;
        stats_record RECORD;
        processed_zai INTEGER := 0;
        processed_deepseek INTEGER := 0;
        failed_zai INTEGER := 0; 
        failed_deepseek INTEGER := 0;
        expired_count INTEGER := 0;
      BEGIN
        -- Log execution start
        INSERT INTO cron_job_events (job_name, event_type, origin, details) 
        VALUES ('retell_queue_manager', 'execution_start', 'cron', 
          jsonb_build_object('start_time', NOW()::text));
        
        -- Expire old pending items (older than 10 minutes)
        UPDATE retell_queue 
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending' 
          AND created_at < NOW() - INTERVAL '10 minutes';
        
        GET DIAGNOSTICS expired_count = ROW_COUNT;
        
        -- Add latest 10 news for each provider (if not already in queue)
        FOR news_record IN (
          SELECT id, title, created_at
          FROM news_items 
          WHERE created_at >= NOW() - INTERVAL '1 hour'
            AND content IS NOT NULL 
            AND content != ''
          ORDER BY created_at DESC 
          LIMIT 20
        ) LOOP
          -- Add to zai queue
          INSERT INTO retell_queue (news_id, provider, status) 
          VALUES (news_record.id, 'zai', 'pending')
          ON CONFLICT (news_id, provider) DO NOTHING;
          
          -- Add to deepseek queue  
          INSERT INTO retell_queue (news_id, provider, status)
          VALUES (news_record.id, 'deepseek', 'pending') 
          ON CONFLICT (news_id, provider) DO NOTHING;
        END LOOP;
        
        -- Process zai queue (reserve and mark as processing)
        UPDATE retell_queue 
        SET status = 'processing', reserved_at = NOW(), updated_at = NOW()
        WHERE id IN (
          SELECT id FROM retell_queue 
          WHERE provider = 'zai' AND status = 'pending'
          ORDER BY created_at ASC 
          LIMIT 10
        );
        
        -- Process deepseek queue
        UPDATE retell_queue
        SET status = 'processing', reserved_at = NOW(), updated_at = NOW() 
        WHERE id IN (
          SELECT id FROM retell_queue
          WHERE provider = 'deepseek' AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT 10  
        );
        
        -- Update hourly statistics
        INSERT INTO retell_stats (provider, date, hour, processed_count, failed_count, expired_count)
        VALUES 
          ('zai', CURRENT_DATE, EXTRACT(hour FROM NOW()), processed_zai, failed_zai, expired_count),
          ('deepseek', CURRENT_DATE, EXTRACT(hour FROM NOW()), processed_deepseek, failed_deepseek, expired_count)
        ON CONFLICT (provider, date, hour) 
        DO UPDATE SET 
          processed_count = retell_stats.processed_count + EXCLUDED.processed_count,
          failed_count = retell_stats.failed_count + EXCLUDED.failed_count,
          expired_count = retell_stats.expired_count + EXCLUDED.expired_count,
          updated_at = NOW();
        
        -- Log completion
        INSERT INTO cron_job_events (job_name, event_type, origin, details)
        VALUES ('retell_queue_manager', 'execution_complete', 'cron',
          jsonb_build_object(
            'end_time', NOW()::text,
            'expired_items', expired_count,
            'zai_processed', processed_zai,
            'deepseek_processed', processed_deepseek
          ));
          
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO cron_job_events (job_name, event_type, origin, details)
        VALUES ('retell_queue_manager', 'execution_error', 'cron',
          jsonb_build_object('error_time', NOW()::text, 'error', SQLERRM));
      END $$;
    `;
    
    const createJobSql = `
      -- Remove existing queue manager
      SELECT cron.unschedule('retell_queue_manager') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'retell_queue_manager'
      );
      
      -- Create new queue manager (every 10 minutes)
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
      console.log(`   ✅ Created queue manager job: ${JSON.stringify(result)}`);
    } else {
      const error = await jobResponse.text();
      console.log(`   ❌ Error creating job: ${error}`);
    }
    
    console.log('\n🎊 CLEANUP AND SETUP COMPLETE!');
    console.log('===============================');
    console.log('✅ Removed all old retell cron jobs');
    console.log('✅ Cleaned old configs and events');
    console.log('✅ Created new retell_queue table');
    console.log('✅ Created new retell_stats table');
    console.log('✅ Created retell_queue_manager cron (every 10 minutes)');
    console.log('');
    console.log('📊 New System Features:');
    console.log('• Separate queues for zai and deepseek providers');
    console.log('• Automatic expiration of old queue items (10 min)');
    console.log('• Latest 10 news reserved for each provider every 10 min');
    console.log('• Comprehensive statistics collection');
    console.log('• Full error handling and logging');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

console.log('🧹 Cron System Cleanup & Rebuild');
console.log('=================================\n');
cleanupOldCrons();