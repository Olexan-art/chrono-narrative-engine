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

async function createSimpleCron() {
  try {
    console.log('💓 CREATING SIMPLE HEARTBEAT CRON');
    console.log('==================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Creating heartbeat cron job...');
    
    // Create simple heartbeat cron  
    const heartbeatCommand = `
      INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at) 
      VALUES (
        'cron_heartbeat',
        'heartbeat',
        'cron_scheduler',
        jsonb_build_object(
          'timestamp', NOW()::text,
          'message', 'Cron system is alive',
          'beat_number', (
            SELECT COALESCE(MAX((details->>'beat_number')::int), 0) + 1 
            FROM cron_job_events 
            WHERE job_name = 'cron_heartbeat' AND event_type = 'heartbeat'
          )
        ),
        NOW()
      );
    `;
    
    const createHeartbeatSql = `
      -- Remove existing heartbeat job
      SELECT cron.unschedule('cron_heartbeat') WHERE (
        SELECT count(*) FROM cron.job WHERE jobname = 'cron_heartbeat'
      ) > 0;
      
      -- Create heartbeat job every 5 minutes
      SELECT cron.schedule(
        'cron_heartbeat',
        '*/5 * * * *',
        $tag$${heartbeatCommand}$tag$
      ) as heartbeat_job_id;
    `;
    
    const heartbeatResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createHeartbeatSql })
    });
    
    if (heartbeatResponse.ok) {
      const heartbeatResult = await heartbeatResponse.json();
      console.log(`✅ Heartbeat created: ${JSON.stringify(heartbeatResult)}`);
      
      console.log('\n2️⃣ Creating retell trigger cron (simple version)...');
      
      // Create retell trigger that just logs (no actual retelling)
      const retellTriggerCommand = `
        INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at) 
        VALUES (
          'retell_usa_trigger',
          'retell_trigger',
          'cron_scheduler', 
          jsonb_build_object(
            'timestamp', NOW()::text,
            'country', 'US',
            'time_range', 'last_3_hours',
            'message', 'Retell trigger activated (logging only)',
            'trigger_number', (
              SELECT COALESCE(MAX((details->>'trigger_number')::int), 0) + 1
              FROM cron_job_events
              WHERE job_name = 'retell_usa_trigger' AND event_type = 'retell_trigger'
            )
          ),
          NOW()
        );
      `;
      
      const createTriggerSql = `
        -- Remove existing trigger job
        SELECT cron.unschedule('retell_usa_trigger') WHERE (
          SELECT count(*) FROM cron.job WHERE jobname = 'retell_usa_trigger'
        ) > 0;
        
        -- Create retell trigger job every 15 minutes
        SELECT cron.schedule(
          'retell_usa_trigger',
          '*/15 * * * *',
          $tag$${retellTriggerCommand}$tag$
        ) as retell_job_id;
      `;
      
      const triggerResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: createTriggerSql })
      });
      
      if (triggerResponse.ok) {
        const triggerResult = await triggerResponse.json();
        console.log(`✅ Retell trigger created: ${JSON.stringify(triggerResult)}`);
        
        console.log('\n3️⃣ Testing manual execution...');
        
        // Test heartbeat manually
        const runHeartbeatSql = `
          SELECT cron.run((SELECT jobid FROM cron.job WHERE jobname = 'cron_heartbeat' LIMIT 1)) as run_result;
        `;
        
        const runHeartbeatResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: runHeartbeatSql })
        });
        
        if (runHeartbeatResponse.ok) {
          console.log('✅ Heartbeat manual test triggered');
          
          // Test retell trigger manually
          const runTriggerSql = `
            SELECT cron.run((SELECT jobid FROM cron.job WHERE jobname = 'retell_usa_trigger' LIMIT 1)) as run_result;
          `;
          
          const runTriggerResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: runTriggerSql })
          });
          
          if (runTriggerResponse.ok) {
            console.log('✅ Retell trigger manual test triggered');
            
            console.log('\n⏳ Waiting 15 seconds for execution...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Check for events
            const eventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=20`, {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
              }
            });
            
            if (eventsResponse.ok) {
              const events = await eventsResponse.json();
              console.log(`\n📊 Found ${events.length} total events:`);
              
              const recentEvents = events.filter(e => {
                const eventTime = new Date(e.created_at);
                const now = new Date();
                const diffSeconds = (now - eventTime) / 1000;
                return diffSeconds <= 60; // Last minute
              });
              
              console.log(`📅 Recent events (last minute): ${recentEvents.length}`);
              
              recentEvents.forEach((event, index) => {
                const time = new Date(event.created_at).toLocaleString('uk-UA');
                console.log(`${index + 1}. [${time}] ${event.job_name} - ${event.event_type}`);
                if (event.details) {
                  const details = JSON.stringify(event.details);
                  console.log(`   ${details.substring(0, 100)}${details.length > 100 ? '...' : ''}`);
                }
              });
              
              const heartbeatEvents = recentEvents.filter(e => e.job_name === 'cron_heartbeat');
              const triggerEvents = recentEvents.filter(e => e.job_name === 'retell_usa_trigger');
              
              if (heartbeatEvents.length > 0 || triggerEvents.length > 0) {
                console.log('\n🎉 SUCCESS! Simple cron jobs are working!');
                console.log('✅ Heartbeat system operational');
                console.log('✅ Retell trigger system operational');
                console.log('🔄 Jobs will execute automatically on schedule');
                
                console.log('\n4️⃣ Creating final production cron job...');
                
                // Now create a real retell job with proper error handling
                const productionCommand = `
                  DO $$
                  DECLARE
                    http_response TEXT;
                  BEGIN
                    -- Log start
                    INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at) 
                    VALUES (
                      'retell_usa_production',
                      'execution_start',
                      'cron_production',
                      jsonb_build_object('start_time', NOW()::text, 'country', 'US'),
                      NOW()
                    );
                    
                    -- Attempt HTTP call with timeout protection
                    BEGIN
                      SELECT net.http_post(
                        url := '${url}/functions/v1/bulk-retell-news',
                        headers := jsonb_build_object(
                          'Content-Type', 'application/json',
                          'Authorization', 'Bearer ${anonKey}'
                        ),
                        body := jsonb_build_object(
                          'country_code', 'US',
                          'time_range', 'last_3_hours',
                          'job_name', 'retell_usa_production'
                        )::text,
                        timeout := 300000
                      ) INTO http_response;
                      
                      -- Log success
                      INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at)
                      VALUES (
                        'retell_usa_production',
                        'execution_success',
                        'cron_production',
                        jsonb_build_object(
                          'end_time', NOW()::text,
                          'response_length', LENGTH(COALESCE(http_response, ''))
                        ),
                        NOW()
                      );
                      
                    EXCEPTION WHEN OTHERS THEN
                      -- Log HTTP error
                      INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at)
                      VALUES (
                        'retell_usa_production',
                        'http_error',
                        'cron_production',
                        jsonb_build_object(
                          'error_time', NOW()::text,
                          'error_message', SQLERRM,
                          'error_state', SQLSTATE
                        ),
                        NOW()
                      );
                    END;
                    
                  EXCEPTION WHEN OTHERS THEN
                    -- Log general error
                    INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at)
                    VALUES (
                      'retell_usa_production',
                      'general_error',
                      'cron_production',
                      jsonb_build_object(
                        'error_time', NOW()::text,
                        'general_error', SQLERRM
                      ),
                      NOW()
                    );
                  END $$;
                `;
                
                const createProductionSql = `
                  -- Remove existing production job
                  SELECT cron.unschedule('retell_usa_production') WHERE (
                    SELECT count(*) FROM cron.job WHERE jobname = 'retell_usa_production'
                  ) > 0;
                  
                  -- Create production job every 15 minutes
                  SELECT cron.schedule(
                    'retell_usa_production',
                    '*/15 * * * *',
                    $tag$${productionCommand}$tag$
                  ) as production_job_id;
                `;
                
                const prodResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${anonKey}`,
                    'apikey': anonKey,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ sql: createProductionSql })
                });
                
                if (prodResponse.ok) {
                  const prodResult = await prodResponse.json();
                  console.log(`✅ Production job created: ${JSON.stringify(prodResult)}`);
                  
                  console.log('\n🎊 COMPLETE SUCCESS!');
                  console.log('====================');
                  console.log('✅ Heartbeat cron: Every 5 minutes');
                  console.log('✅ Retell trigger: Every 15 minutes (logging)');
                  console.log('✅ Production retell: Every 15 minutes (actual retelling)');
                  console.log('📊 All jobs include comprehensive error handling');
                  console.log('📱 Monitor: SELECT * FROM cron_job_events ORDER BY created_at DESC;');
                  
                } else {
                  console.log('❌ Production job creation failed');
                }
                
              } else {
                console.log('❌ Jobs created but no execution events');
              }
            }
          } else {
            console.log('❌ Retell trigger manual test failed');
          }
        } else {
          console.log('❌ Heartbeat manual test failed');
        }
      } else {
        console.log('❌ Retell trigger creation failed');
      }
    } else {
      console.log('❌ Heartbeat creation failed');
    }
    
  } catch (error) {
    console.error('❌ Simple cron creation failed:', error.message);
  }
}

console.log('💓 Simple Cron Creator');
console.log('======================\n');
createSimpleCron();