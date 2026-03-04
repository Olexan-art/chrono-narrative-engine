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

async function checkTable() {
  console.log('🔍 Examining cron_job_configs table...\n');
  
  // Try to fetch all rows and examine the structure
  console.log('Attempting to fetch all rows:');
  const { data, error: fetchError } = await supabase
    .from('cron_job_configs')
    .select('*');
  
  if (fetchError) {
    console.log(`Error: ${fetchError.message}`);
  } else {
    console.log(`Found ${data?.length || 0} rows`);
    if (data && data.length > 0) {
      console.log('Columns in first row:');
      Object.keys(data[0]).forEach(col => {
        console.log(`  - ${col}: ${typeof data[0][col]} (${data[0][col]})`);
      });
    }
  }
  
  // Try to insert a test row with minimal data
  console.log('\nAttempting to insert a test row...');
  const testRow = {
    job_name: 'test_job_' + Date.now(),
    enabled: true,
    frequency_minutes: 60
  };
  
  const { data: insertData, error: insertError } = await supabase
    .from('cron_job_configs')
    .insert([testRow]);
  
  if (insertError) {
    console.log(`❌ Insert error: ${insertError.message}`);
    console.log(`   Code: ${insertError.code}`);
    console.log(`   Details: ${insertError.details}`);
  } else {
    console.log(`✅ Insert successful!`);
    console.log(`   Data:`, insertData);
  }
  
  // Verify it was inserted
  if (!insertError) {
    console.log('\nVerifying insert...');
    const { data: verifyData } = await supabase
      .from('cron_job_configs')
      .select('*');
    
    console.log(`Current table has ${verifyData?.length || 0} rows`);
  }
}

checkTable();
