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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function inspectPgCronJobs() {
  try {
    console.log('🔍 Inspecting pg_cron jobs in database...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'inspectPgCron',
        password: '1nuendo19071',
        data: {
          jobName: '%bulk_retell%'
        }
      })
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 Response preview:', text.substring(0, 300));
    
    try {
      const result = JSON.parse(text);
      console.log('\n📊 Parsed response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success && result.rows) {
        console.log('\n📋 pg_cron jobs found:');
        result.rows.forEach((row, i) => {
          console.log(`${i+1}. Job ID: ${row.jobid}`);
          console.log(`   Name: ${row.jobname}`);
          console.log(`   Schedule: ${row.schedule}`);
          console.log(`   Next run: ${row.next_run}`);
          console.log(`   Active: ${row.active}`);
          console.log(`   Last run: ${row.last_run}`);
          console.log(`   Last status: ${row.last_status}`);
          console.log('');
        });
      }
    } catch (e) {
      console.log('Could not parse as JSON');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

inspectPgCronJobs();