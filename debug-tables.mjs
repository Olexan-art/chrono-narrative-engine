import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugTables() {
  console.log('🔍 Debugging cron tables...\n');
  
  // Try to get cron_job_configs with error details
  console.log('1️⃣ Trying cron_job_configs:');
  try {
    const result = await supabase
      .from('cron_job_configs')
      .select('*');
    
    if (result.error) {
      console.log(`   Error: ${result.error.message}`);
      console.log(`   Code: ${result.error.code}`);
    } else {
      console.log(`   ✅ Success! Found ${result.data?.length || 0} records`);
      if (result.data && result.data.length > 0) {
        console.log(`   First record keys: ${Object.keys(result.data[0]).join(', ')}`);
        console.log('\n   Records:');
        result.data.slice(0, 5).forEach((r, i) => {
          console.log(`   ${i + 1}. ${JSON.stringify(r)}`);
        });
      }
    }
  } catch (error) {
    console.log(`   Exception: ${error.message}`);
  }
  
  // Try cron_job_events
  console.log('\n2️⃣ Trying cron_job_events:');
  try {
    const result = await supabase
      .from('cron_job_events')
      .select('*')
      .limit(5);
    
    if (result.error) {
      console.log(`   Error: ${result.error.message}`);
    } else {
      console.log(`   ✅ Success! Found ${result.data?.length || 0} records`);
      if (result.data && result.data.length > 0) {
        console.log(`   Columns: ${Object.keys(result.data[0]).join(', ')}`);
      }
    }
  } catch (error) {
    console.log(`   Exception: ${error.message}`);
  }
  
  // Try to find other cron-related tables
  console.log('\n3️⃣ Searching for other cron-related tables:');
  const tablesToTry = [
    'cron_configs',
    'cron_schedule',
    'cron_jobs',
    'scheduled_jobs',
    'retell_crons',
    'news_cron_jobs',
    'jobs'
  ];
  
  for (const table of tablesToTry) {
    try {
      const result = await supabase
        .from(table)
        .select('count', { count: 'exact' });
      
      if (!result.error && result.count !== null) {
        console.log(`   ✅ ${table}: ${result.count} records`);
      }
    } catch (e) {
      // Skip
    }
  }
  
  console.log('\n✅ Debug complete!');
}

debugTables();
