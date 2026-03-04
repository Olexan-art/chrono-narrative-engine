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

async function debugCronIssue() {
  try {
    console.log('🔍 DEBUGGING CRON ISSUE\n');
    console.log('=======================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';
    
    console.log('1️⃣ Checking recent execution logs...');
    
    const logsUrl = `${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=15`;
    const logsResponse = await fetch(logsUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (logsResponse.ok) {
      const logs = await logsResponse.json();
      console.log(`📊 Found ${logs.length} recent log entries:`);
      logs.forEach((log, index) => {
        const time = new Date(log.created_at).toLocaleString('uk-UA');
        console.log(`${index + 1}. [${time}] ${log.job_name || 'unknown'} - ${log.event_type}`);
        if (log.details) {
          console.log(`   Details: ${JSON.stringify(log.details)}`);
        }
        console.log('');
      });
      
      const errors = logs.filter(log => log.details && (log.details.error || log.details.status >= 400));
      if (errors.length > 0) {
        console.log(`❌ Found ${errors.length} error(s) in logs`);
      }
    } else {
      console.log('❌ Failed to get logs');
    }
    
    console.log('\n2️⃣ Testing Edge Function directly...');
    
    // Test with different authentication
    const testResponse = await fetch(`${url}/functions/v1/bulk-retell-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        country_code: 'US',
        time_range: '3',
        job_name: 'test_direct',
        trigger: 'manual'
      })
    });
    
    const testResult = await testResponse.text();
    console.log(`🧪 Direct test with service key: ${testResponse.status}`);
    console.log(`Response: ${testResult.substring(0, 200)}...`);
    
    if (testResponse.status === 200) {
      console.log('✅ Edge Function works with service key!');
      
      console.log('\n3️⃣ Fixing cron commands...');
      
      // Fix the commands by recreating them with proper JSON escaping
      const fixedCommands = [
        {
          name: 'retell_recent_usa',
          schedule: '*/15 * * * *',
          command: `SELECT net.http_post(
            url := '${url}/functions/v1/bulk-retell-news',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb,
            body := '{"country_code": "US", "time_range": "3", "job_name": "retell_recent_usa", "trigger": "cron"}'::jsonb,
            timeout := 60000
          )`
        },
        {
          name: 'news_fetching',
          schedule: '*/15 * * * *',
          command: `SELECT net.http_post(
            url := '${url}/functions/v1/fetch-rss',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${serviceKey}"}'::jsonb,
            body := '{"action": "fetch_all"}'::jsonb,
            timeout := 60000
          )`
        }
      ];
      
      let fixed = 0;
      
      for (const cmd of fixedCommands) {
        console.log(`🔧 Fixing ${cmd.name}...`);
        
        try {
          // Remove existing job
          await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: `SELECT cron.unschedule('${cmd.name}')` })
          });
          
          // Create fixed job
          const createResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              sql: `SELECT cron.schedule('${cmd.name}', '${cmd.schedule}', $tag$${cmd.command}$tag$) as job_id`
            })
          });
          
          if (createResponse.ok) {
            console.log(`   ✅ Fixed ${cmd.name}`);
            fixed++;
          } else {
            console.log(`   ❌ Failed to fix ${cmd.name}`);
          }
          
        } catch (err) {
          console.log(`   ❌ Error fixing ${cmd.name}: ${err.message}`);
        }
      }
      
      console.log(`\n📊 Fixed ${fixed}/${fixedCommands.length} jobs`);
      
      if (fixed > 0) {
        console.log('\n4️⃣ Testing fixed job...');
        
        // Test by running the first fixed job manually
        const testJobSql = `SELECT cron.run((SELECT jobid FROM cron.job WHERE jobname = 'retell_recent_usa' LIMIT 1))`;
        
        const testJobResponse = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: testJobSql })
        });
        
        if (testJobResponse.ok) {
          console.log('🧪 Test execution triggered');
          console.log('⏳ Wait 30 seconds and check logs again...');
        }
      }
      
    } else {
      console.log('❌ Edge Function still fails with service key');
      console.log('💡 The SERVICE_ROLE_KEY might need to be set in Dashboard after all');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

console.log('🚀 Cron Debug & Fix Tool');
console.log('========================\n');
debugCronIssue();