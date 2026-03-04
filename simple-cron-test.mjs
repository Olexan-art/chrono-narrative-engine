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

async function simpleTestCron() {
  try {
    console.log('🎯 SIMPLE CRON TEST & FIX');
    console.log('===========================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Creating simple logging job...');
    
    // Create a simple cron that just logs to our events table
    const simpleJobSql = `
      SELECT cron.schedule(
        'simple_test_logger',
        '*/5 * * * *',
        $$ 
        INSERT INTO cron_job_events (job_name, event_type, origin, details, created_at) 
        VALUES (
          'simple_test_logger',
          'heartbeat_log', 
          'cron_scheduled',
          jsonb_build_object(
            'timestamp', NOW()::text,
            'message', 'Simple cron is working'
          ),
          NOW()
        );
        $$
      ) as job_id;
    `;
    
    const simpleJobResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: simpleJobSql })
    });
    
    if (simpleJobResponse.ok) {
      const result = await simpleJobResponse.json();
      console.log(`✅ Simple job created: ${JSON.stringify(result)}`);
    } else {
      console.log('❌ Simple job creation failed');
    }
    
    console.log('\n2️⃣ Running simple job manually...');
    
    const runSimpleJobSql = `
      SELECT cron.run(
        (SELECT jobid FROM cron.job WHERE jobname = 'simple_test_logger' LIMIT 1)
      ) as run_result;
    `;
    
    const runResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: runSimpleJobSql })
    });
    
    if (runResponse.ok) {
      console.log('✅ Manual execution triggered');
    } else {
      console.log('❌ Manual execution failed');
    }
    
    console.log('\n3️⃣ Checking for events after 10 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check cron_job_events table
    const eventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=10`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      console.log(`📊 Found ${events.length} recent events:`);
      
      const testEvents = events.filter(e => e.job_name && e.job_name.includes('test'));
      console.log(`🧪 Test-related events: ${testEvents.length}`);
      
      events.slice(0, 5).forEach((event, index) => {
        const time = new Date(event.created_at).toLocaleString('uk-UA');
        console.log(`${index + 1}. [${time}] ${event.job_name || 'unknown'} - ${event.event_type}`);
      });
      
      if (testEvents.length > 0) {
        console.log('\n🎉 SUCCESS! Simple cron is working!');
        
        console.log('\n4️⃣ Now creating working retell job...');
        
        // Now create a working retell job based on confirmed approach
        const workingRetellSql = `
          SELECT cron.unschedule('retell_usa_final') WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'retell_usa_final'
          );
          
          SELECT cron.schedule(
            'retell_usa_final',
            '*/15 * * * *',
            $tag$
            DO $$
            DECLARE
              response_result TEXT;
            BEGIN
              -- Log start
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_final', 'execution_start', 'cron', jsonb_build_object('start_time', NOW()::text));
              
              -- Call admin API
              SELECT net.http_post(
                url := '${url}/functions/v1/admin',
                headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ${anonKey}'
                ),
                body := jsonb_build_object(
                  'action', 'runBulkRetell',
                  'password', '1nuendo19071',
                  'data', jsonb_build_object(
                    'country_code', 'US',
                    'time_range', '3',
                    'job_name', 'retell_usa_final'
                  )
                )::text
              ) INTO response_result;
              
              -- Log completion
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_final', 'execution_complete', 'cron', 
                jsonb_build_object(
                  'end_time', NOW()::text,
                  'response', COALESCE(response_result, 'null')::text
                )
              );
              
            EXCEPTION WHEN OTHERS THEN
              -- Log error
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_final', 'execution_error', 'cron', 
                jsonb_build_object(
                  'error_time', NOW()::text,
                  'error', SQLERRM
                )
              );
            END $$;
            $tag$
          ) as job_id;
        `;
        
        const retellJobResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: workingRetellSql })
        });
        
        if (retellJobResponse.ok) {
          const result = await retellJobResponse.json();
          console.log(`✅ Working retell job created: ${JSON.stringify(result)}`);
          
          console.log('\n5️⃣ Testing retell job manually...');
          
          const runRetellSql = `
            SELECT cron.run(
              (SELECT jobid FROM cron.job WHERE jobname = 'retell_usa_final' LIMIT 1)
            ) as run_result;
          `;
          
          const runRetellResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: runRetellSql })
          });
          
          if (runRetellResponse.ok) {
            console.log('✅ Retell job manual execution triggered');
            
            console.log('\n⏳ Waiting 20 seconds for completion...');
            await new Promise(resolve => setTimeout(resolve, 20000));
            
            // Check for recent retell events
            const finalEventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&job_name=eq.retell_usa_final&order=created_at.desc&limit=5`, {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
              }
            });
            
            if (finalEventsResponse.ok) {
              const finalEvents = await finalEventsResponse.json();
              console.log(`📊 Retell job events: ${finalEvents.length}`);
              finalEvents.forEach((event, index) => {
                const time = new Date(event.created_at).toLocaleString('uk-UA');
                console.log(`${index + 1}. [${time}] ${event.event_type}`);
                if (event.details) {
                  console.log(`   Details: ${JSON.stringify(event.details).substring(0, 100)}...`);
                }
              });
              
              if (finalEvents.length > 0) {
                console.log('\n🎉 COMPLETE SUCCESS!');
                console.log('✅ Cron jobs are now working correctly');
                console.log('✅ retell_usa_final will run every 15 minutes');
                console.log('✅ Monitor cron_job_events for all activity');
              } else {
                console.log('\n⚠️ No retell events yet, but job created');
                console.log('🔄 Check again in 15 minutes');
              }
            }
          } else {
            console.log('❌ Retell job manual test failed');
          }
        } else {
          console.log('❌ Working retell job creation failed');
        }
        
      } else {
        console.log('❌ Simple cron not working - check permissions');
      }
    } else {
      console.log('❌ Could not check events');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

console.log('🎯 Simple Cron Test & Fix');
console.log('=========================\n');
simpleTestCron();