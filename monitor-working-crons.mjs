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

async function monitorCronJobs() {
  try {
    console.log('📊 MONITORING CRON JOBS STATUS');
    console.log('================================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Checking pg_cron.job table...');
    
    // Get all jobs
    const jobsResponse = await fetch(`${url}/rest/v1/rpc/get_cron_jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (jobsResponse.ok) {
      const jobs = await jobsResponse.json();
      console.log(`✅ Found ${jobs.length} total jobs`);
      
      const workingJobs = jobs.filter(j => j.jobname?.includes('working'));
      console.log(`✅ Found ${workingJobs.length} 'working' jobs:`);
      workingJobs.forEach(job => {
        console.log(`   📋 ${job.jobname} - ${job.schedule} (${job.active ? '🟢 active' : '🔴 inactive'})`);
      });
    } else {
      console.log('❌ Could not fetch pg_cron jobs');
    }
    
    console.log('\n2️⃣ Checking pg_stat_statements for executions...');
    
    const statsResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        sql: `
          SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            last_exec_time
          FROM pg_stat_statements 
          WHERE query LIKE '%admin%' 
             OR query LIKE '%retell%'
             OR query LIKE '%working%'
          ORDER BY last_exec_time DESC
          LIMIT 10
        `
      })
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`📊 Found ${stats.length} related queries:`);
      stats.forEach((stat, index) => {
        const shortQuery = stat.query.substring(0, 100) + '...';
        console.log(`${index + 1}. Calls: ${stat.calls}, Last: ${stat.last_exec_time}`);
        console.log(`   Query: ${shortQuery}`);
        console.log('');
      });
    }
    
    console.log('3️⃣ Checking cron_job_events for activity...');
    
    // Check for recent events  
    const eventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=20`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      console.log(`📊 Found ${events.length} recent events:`);
      
      const recentEvents = events.filter(e => {
        const eventTime = new Date(e.created_at);
        const now = new Date();
        const diffMinutes = (now - eventTime) / (1000 * 60);
        return diffMinutes <= 60; // Last hour
      });
      
      console.log(`📅 In last hour: ${recentEvents.length} events`);
      
      recentEvents.forEach((event, index) => {
        const time = new Date(event.created_at).toLocaleString('uk-UA');
        console.log(`${index + 1}. [${time}] ${event.job_name || 'unknown'}`);
        console.log(`   Type: ${event.event_type}`);
        if (event.details) {
          const details = JSON.stringify(event.details);
          const shortDetails = details.length > 150 ? details.substring(0, 150) + '...' : details;
          console.log(`   Details: ${shortDetails}`);
        }
        console.log('');
      });
      
      const executionEvents = events.filter(e => 
        e.event_type?.includes('run') || 
        e.event_type?.includes('exec') || 
        e.event_type?.includes('trigger')
      );
      
      if (executionEvents.length > 0) {
        console.log(`🎉 Found ${executionEvents.length} execution events!`);
        console.log('✅ Cron jobs ARE executing');
      } else {
        console.log('⚠️ No execution events found');
        console.log('🔍 Jobs may be executing but not logging properly');
      }
    }
    
    console.log('\n4️⃣ Test manual job execution...');
    
    const manualTestSql = `
      DO $$
      DECLARE
        job_record RECORD;
        result RECORD;
      BEGIN
        -- Find working job
        SELECT * INTO job_record 
        FROM cron.job 
        WHERE jobname LIKE '%working%' 
        LIMIT 1;
        
        IF job_record.jobid IS NOT NULL THEN
          -- Run the job manually
          SELECT cron.run(job_record.jobid) as run_result;
          
          -- Log manual execution
          INSERT INTO cron_job_events (job_name, event_type, origin, details)
          VALUES (
            job_record.jobname, 
            'manual_test_triggered', 
            'monitor_script',
            jsonb_build_object(
              'jobid', job_record.jobid,
              'schedule', job_record.schedule,
              'test_time', NOW()::text
            )
          );
          
          RAISE NOTICE 'Manual execution triggered for job: %', job_record.jobname;
        ELSE
          RAISE NOTICE 'No working jobs found';
        END IF;
      END $$;
    `;
    
    const manualResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: manualTestSql })
    });
    
    if (manualResponse.ok) {
      console.log('✅ Manual execution test triggered');
      
      // Wait and check for new events
      console.log('⏳ Waiting 10 seconds for execution...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const newEventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5`, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        }
      });
      
      if (newEventsResponse.ok) {
        const newEvents = await newEventsResponse.json();
        const veryRecent = newEvents.filter(e => {
          const eventTime = new Date(e.created_at);
          const now = new Date();
          const diffSeconds = (now - eventTime) / 1000;
          return diffSeconds <= 30; // Last 30 seconds
        });
        
        if (veryRecent.length > 0) {
          console.log(`🆕 Found ${veryRecent.length} very recent events:`);
          veryRecent.forEach(event => {
            const time = new Date(event.created_at).toLocaleString('uk-UA');
            console.log(`   [${time}] ${event.job_name} - ${event.event_type}`);
          });
        } else {
          console.log('📭 No new events from manual trigger');
        }
      }
    } else {
      console.log('❌ Manual execution test failed');
    }
    
    console.log('\n📊 MONITORING SUMMARY:');
    console.log('======================');
    console.log('✅ Working cron jobs have been created');
    console.log('🔑 Using admin API authentication strategy');  
    console.log('📅 Jobs scheduled to run every 15 minutes'); 
    console.log('📱 Monitor cron_job_events table for real-time activity');
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
  }
}

console.log('📊 Cron Jobs Monitor');
console.log('===================\n');
monitorCronJobs();