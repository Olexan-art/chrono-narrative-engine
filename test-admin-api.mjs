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

async function testAdminAPI() {
  try {
    console.log('🔧 Testing admin API to configure crons...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    const payload = {
      action: 'updateCronConfig',
      password: '1nuendo19071',
      data: {
        jobName: 'retell_recent_usa',
        config: {
          enabled: true,
          frequency_minutes: 15,
          countries: ['us']
        }
      }
    };
    
    console.log('📤 Calling admin/updateCronConfig for retell_recent_usa...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`   Status: ${response.status}`);

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { raw: text };
    }
    
    if (response.ok) {
      console.log('✅ Response: ' + JSON.stringify(result));
    } else {
      console.log('❌ Error: ' + JSON.stringify(result));
    }
    
    // Wait 2 seconds then check if it was saved
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('\n📋 Checking database for the config...');
    
    const checkUrl = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/cron_job_configs?job_name=eq.retell_recent_usa&select=*';
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    const checkData = await checkResponse.json();
    
    if (Array.isArray(checkData) && checkData.length > 0) {
      console.log('✅ Found in database! Config:');
      console.log(JSON.stringify(checkData[0], null, 2));
    } else {
      console.log('❌ Not found in database');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAdminAPI();
