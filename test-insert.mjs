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

async function testDirectInsert() {
  console.log('🔧 Testing direct insert into cron_job_configs...\n');
  
  const testData = {
    job_name: 'test_' + Date.now(),
    enabled: true,
    frequency_minutes: 60,
    countries: ['us'],
    processing_options: { test: true }
  };
  
  console.log('Attempting insert:', testData.job_name);
  
  const { data, error } = await supabase
    .from('cron_job_configs')
    .insert([testData]);
  
  if (error) {
    console.log('❌ Error:', error.message);
    if (error.code === '42501') {
      console.log('   → RLS still blocking inserts');
    }
  } else {
    console.log('✅ Insert successful!');
    console.log('   Data:', data);
    
    // Try to read it back
    const { data: readBack } = await supabase
      .from('cron_job_configs')
      .select('*')
      .eq('job_name', testData.job_name);
    
    console.log('\n✅ Read back:', readBack?.length || 0, 'record(s)');
  }
}

testDirectInsert();
