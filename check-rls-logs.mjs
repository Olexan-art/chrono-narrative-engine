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
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies for cron_job_events table...\n');
  
  // Test with anon key
  console.log('📋 Testing with ANON KEY:');
  try {
    const anonUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=count';
    const anonResponse = await fetch(anonUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    console.log(`   Status: ${anonResponse.status}`);
    const anonText = await anonResponse.text();
    console.log(`   Response: ${anonText.substring(0, 200)}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  if (SUPABASE_SERVICE_KEY) {
    console.log('\n📋 Testing with SERVICE ROLE KEY:');
    try {
      const serviceUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events?select=count';
      const serviceResponse = await fetch(serviceUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        }
      });
      console.log(`   Status: ${serviceResponse.status}`);
      const serviceText = await serviceResponse.text();
      console.log(`   Response: ${serviceText.substring(0, 200)}`);
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  } else {
    console.log('\n❌ SERVICE ROLE KEY not found in environment');
  }

  // Try to INSERT with service role key
  if (SUPABASE_SERVICE_KEY) {
    console.log('\n📤 Testing INSERT with SERVICE ROLE KEY:');
    try {
      const insertUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_events';
      const insertResponse = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          job_name: 'test_manual_insert',
          event_type: 'run_started',
          origin: 'manual_test',
          details: { test: true }
        })
      });
      console.log(`   Status: ${insertResponse.status}`);
      const insertText = await insertResponse.text();
      console.log(`   Response: ${insertText.substring(0, 300)}`);
      
      if (insertResponse.ok) {
        console.log('✅ INSERT successful - RLS is working for service role');
      } else {
        console.log('❌ INSERT failed - possible RLS issue');
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
    }
  }
}

checkRLSPolicies();