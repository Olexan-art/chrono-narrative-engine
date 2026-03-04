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

async function testCronSql() {
  try {
    console.log('🔍 Direct pg_cron SQL Testing\n');
    console.log('=============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Test basic SQL execution
    console.log('1️⃣ Testing basic SQL exec...');
    
    const basicSqlResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: { 
          sql: 'SELECT current_timestamp as test_time'
        }
      })
    });
    
    if (basicSqlResponse.ok) {
      const basicResult = await basicSqlResponse.json();
      console.log('✅ Basic SQL works:', basicResult);
    } else {
      console.log('❌ Basic SQL failed:', await basicSqlResponse.text());
    }
    
    // Test pg_cron extension availability
    console.log('\n2️⃣ Testing pg_cron extension...');
    
    const cronExtResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron', 
        password: '1nuendo19071',
        data: {
          sql: "SELECT * FROM pg_extension WHERE extname = 'pg_cron'"
        }
      })
    });
    
    if (cronExtResponse.ok) {
      const cronExt = await cronExtResponse.json();
      console.log('✅ pg_cron extension:', cronExt);
    } else {
      console.log('❌ pg_cron extension check failed:', await cronExtResponse.text());
    }
    
    // Test direct cron.schedule call
    console.log('\n3️⃣ Testing direct cron.schedule...');
    
    const testJob = 'test_job_' + Date.now();
    const testCommand = 'SELECT 1 as test_result';
    const schedule = '*/5 * * * *';
    
    const scheduleResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: {
          sql: `SELECT cron.schedule('${testJob}', '${schedule}', $tag$${testCommand}$tag$) as job_id`
        }
      })
    });
    
    if (scheduleResponse.ok) {
      const scheduleResult = await scheduleResponse.json();
      console.log('✅ cron.schedule test result:', scheduleResult);
      
      // Check if job was created
      if (scheduleResult.success && scheduleResult.rows?.[0]?.job_id) {
        console.log('🎯 Test job created successfully!');
        
        // Clean up test job
        const cleanupResponse = await fetch(`${url}/functions/v1/admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`
          },
          body: JSON.stringify({
            action: 'inspectPgCron',
            password: '1nuendo19071',
            data: {
              sql: `SELECT cron.unschedule('${testJob}')`
            }
          })
        });
        
        if (cleanupResponse.ok) {
          console.log('✅ Test job cleaned up');
        }
      } else {
        console.log('❌ Test job was not created');
      }
    } else {
      console.log('❌ cron.schedule test failed:', await scheduleResponse.text());
    }
    
    // Test cron permissions
    console.log('\n4️⃣ Testing cron permissions...');
    
    const permResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: {
          sql: "SELECT current_user, session_user"
        }
      })
    });
    
    if (permResponse.ok) {
      const permResult = await permResponse.json();
      console.log('✅ User info:', permResult);
    } else {
      console.log('❌ Permission check failed:', await permResponse.text());
    }
    
    // Check if we can see existing cron jobs
    console.log('\n5️⃣ Checking existing cron.job table...');
    
    const jobTableResponse = await fetch(`${url}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: {
          sql: "SELECT COUNT(*) as job_count FROM cron.job"
        }
      })
    });
    
    if (jobTableResponse.ok) {
      const jobTable = await jobTableResponse.json();
      console.log('✅ cron.job table count:', jobTable);
    } else {
      console.log('❌ cron.job table check failed:', await jobTableResponse.text());
    }
    
  } catch (error) {
    console.error('❌ SQL test failed:', error.message);
  }
}

console.log('🚀 pg_cron SQL Diagnostics');
console.log('==========================\n');
testCronSql();