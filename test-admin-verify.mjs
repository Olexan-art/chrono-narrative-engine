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

async function testAdminBasics() {
  try {
    console.log('🧪 Testing admin function verify...\n');
    
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'verify',
        password: '1nuendo19071'
      })
    });

    console.log(`📋 Response status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 Response:', text);
    
    try {
      const result = JSON.parse(text);
      console.log('\n📊 Parsed response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n✅ Admin function is working!');
        console.log('✅ Password authentication works');
        
        // Test environment info
        console.log('\n🔍 Testing environment variables in edge function...');
        await testGetCronConfigs();
      } else {
        console.log('\n❌ Admin function failed');
      }
    } catch (e) {
      console.log('Could not parse as JSON');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function testGetCronConfigs() {
  try {
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'getCronConfigs',
        password: '1nuendo19071'
      })
    });

    console.log(`📋 CronConfigs response: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('📄 CronConfigs preview:', text.substring(0, 300) + '...');
    
    // На цьому етапі ми знаємо що edge function працює
    // Тепер можна дослідити чому edge functions не пишуть логи
    
  } catch (error) {
    console.error('❌ CronConfigs request failed:', error.message);
  }
}

testAdminBasics();