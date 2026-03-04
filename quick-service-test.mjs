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

async function quickServiceKeyTest() {
  try {
    console.log('🔧 Quick service key validation test\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('URL:', url ? 'SET' : 'MISSING');
    console.log('KEY:', key ? `PRESENT (${key.length} chars)` : 'MISSING');
    console.log('');
    
    if (!url || !key) {
      console.log('❌ Missing environment variables');
      return;
    }
    
    // Simple database test with service key
    console.log('📋 Testing database access with service key...');
    const dbUrl = `${url}/rest/v1/cron_job_configs?select=job_name&limit=1`;
    
    const response = await fetch(dbUrl, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'apikey': key
      }
    });
    
    console.log(`Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Service key works for database access');
      
      // Quick edge function test
      console.log('\n📤 Testing edge function admin...');
      const adminUrl = `${url}/functions/v1/admin`;
      const adminResp = await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          action: 'verify',
          password: '1nuendo19071'
        })
      });
      
      console.log(`Admin resp: ${adminResp.status}`);
      const adminText = await adminResp.text();
      console.log(`Admin result: ${adminText.substring(0, 100)}`);
      
    } else {
      const errorText = await response.text();
      console.log(`❌ Database test failed: ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

quickServiceKeyTest();