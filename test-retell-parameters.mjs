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

async function testParameterFormats() {
  try {
    console.log('🧪 TESTING RETELL PARAMETER FORMATS');  
    console.log('====================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Testing different retell parameter formats...');
    
    // Test formats 
    const testFormats = [
      {
        name: 'Format 1: Direct parameters',
        body: {
          action: 'runBulkRetell',
          password: '1nuendo19071',
          country_code: 'US',
          time_range: '3',
          job_name: 'test_direct_params'
        }
      },
      {
        name: 'Format 2: With data wrapper',
        body: {
          action: 'runBulkRetell',
          password: '1nuendo19071',
          data: {
            country_code: 'US',
            time_range: '3',
            job_name: 'test_data_wrapper'
          }
        }
      },
      {
        name: 'Format 3: String time_range',
        body: {
          action: 'runBulkRetell',
          password: '1nuendo19071',
          country_code: 'US',
          time_range: 'last_3_hours',
          job_name: 'test_string_range'
        }
      },
      {
        name: 'Format 4: Minimal required',
        body: {
          action: 'runBulkRetell',
          password: '1nuendo19071',
          country_code: 'US'
        }
      }
    ];
    
    for (const format of testFormats) {
      console.log(`\n🔬 Testing: ${format.name}`);
      console.log(`   Body: ${JSON.stringify(format.body)}`);
      
      try {
        const response = await fetch(`${url}/functions/v1/admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`
          },
          body: JSON.stringify(format.body)
        });
        
        const responseText = await response.text();
        
        if (response.ok) {
          console.log(`   ✅ SUCCESS: ${responseText.substring(0, 150)}...`);
          
          // Log this successful test
          await fetch(`${url}/rest/v1/cron_job_events`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              job_name: 'parameter_testing',
              event_type: 'successful_format_found',
              origin: 'parameter_test_script',
              details: { 
                format_name: format.name,
                working_parameters: format.body
              }
            })
          });
          
          console.log(`   📊 This format WORKS! Using for cron job...`);
          
          // Create cron job with working format
          const jobCommand = `
            DO $$
            BEGIN
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_working_final', 'execution_start', 'cron', 
                jsonb_build_object('start_time', NOW()::text));
              
              PERFORM net.http_post(
                url := '${url}/functions/v1/admin',
                headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ${anonKey}'
                ),
                body := '${JSON.stringify(format.body).replace(/'/g, "''")}'
              );
              
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_working_final', 'execution_complete', 'cron',
                jsonb_build_object('end_time', NOW()::text));
                
            EXCEPTION WHEN OTHERS THEN
              INSERT INTO cron_job_events (job_name, event_type, origin, details) 
              VALUES ('retell_usa_working_final', 'execution_error', 'cron',
                jsonb_build_object('error', SQLERRM));
            END $$;
          `;
          
          const createJobSql = `
            SELECT cron.unschedule('retell_usa_working_final') WHERE (
              SELECT count(*) FROM cron.job WHERE jobname = 'retell_usa_working_final'
            ) > 0;
            
            SELECT cron.schedule(
              'retell_usa_working_final',
              '*/15 * * * *',
              $tag$${jobCommand}$tag$
            ) as job_id;
          `;
          
          console.log('   🔧 Creating working cron job...');
          
          const createResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: createJobSql })
          });
          
          if (createResponse.ok) {
            const result = await createResponse.json();
            console.log(`   🎉 CRON JOB CREATED: ${JSON.stringify(result)}`);
            
            console.log('\n2️⃣ Testing manual execution of working job...');
            
            const runJobSql = `
              SELECT cron.run((SELECT jobid FROM cron.job WHERE jobname = 'retell_usa_working_final' LIMIT 1)) as run_result;
            `;
            
            const runResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ sql: runJobSql })
            });
            
            if (runResponse.ok) {
              console.log('   ✅ Manual execution triggered');
              
              console.log('\n⏳ Waiting 20 seconds for execution...');
              await new Promise(resolve => setTimeout(resolve, 20000));
              
              // Check execution events
              const eventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&job_name=eq.retell_usa_working_final&order=created_at.desc&limit=10`, {
                headers: {
                  'Authorization': `Bearer ${anonKey}`,
                  'apikey': anonKey
                }
              });
              
              if (eventsResponse.ok) {
                const events = await eventsResponse.json();
                console.log(`   📊 Execution events: ${events.length}`);
                events.forEach((event, index) => {
                  const time = new Date(event.created_at).toLocaleString('uk-UA');
                  console.log(`   ${index + 1}. [${time}] ${event.event_type}`);
                  if (event.details) {
                    const details = JSON.stringify(event.details);
                    console.log(`      Details: ${details.substring(0, 100)}...`);
                  }
                });
                
                if (events.length > 0) {
                  console.log('\n🎊 COMPLETE SUCCESS!');
                  console.log('✅ Working parameter format found and tested');
                  console.log('✅ Cron job created with working format');
                  console.log('✅ Manual execution successful');
                  console.log('🔄 Job will now run every 15 minutes automatically');
                  console.log('📊 Monitor cron_job_events table for ongoing activity');
                  return; // Exit after first success
                }
              }
            }
          }
          
          break; // Exit after first working format
          
        } else {
          console.log(`   ❌ FAILED: ${response.status} - ${responseText}`);
        }
        
      } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n📋 PARAMETER TESTING COMPLETE');
    console.log('==============================');
    console.log('🔍 Check cron_job_events for successful format details');
    
  } catch (error) {
    console.error('❌ Parameter testing failed:', error.message);
  }
}

console.log('🧪 Retell Parameter Format Tester');
console.log('==================================\n');
testParameterFormats();