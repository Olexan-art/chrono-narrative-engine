import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Manually set the correct service role key here
const CORRECT_SERVICE_KEY = "f2d94e0dc"; // Put the full key here when you find it

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

async function testWithCorrectKey() {
  try {
    console.log('🧪 Testing with manually provided service role key...\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const currentKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('📋 Keys comparison:');
    console.log(`Current .env key: ${currentKey?.substring(0, 20)}...`);
    console.log(`Looking for key:  ${CORRECT_SERVICE_KEY}...`);
    console.log('');
    
    if (CORRECT_SERVICE_KEY === "f2d94e0dc") {
      console.log('❌ Please update CORRECT_SERVICE_KEY with the full key from Supabase Dashboard');
      console.log('1. Go to https://supabase.com/dashboard');
      console.log('2. Your project → Settings → API');
      console.log('3. Copy the service_role key (secret key)');
      console.log('4. Update this script with the full key');
      return;
    }
    
    // Test with correct key
    console.log('📤 Testing bulk-retell-news with correct service key...');
    const response = await fetch(`${url}/functions/v1/bulk-retell-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CORRECT_SERVICE_KEY}`
      },
      body: JSON.stringify({
        country_code: 'us',
        time_range: 'last_1h', 
        job_name: 'test_correct_key',
        trigger: 'manual'
      })
    });

    console.log(`📋 Response: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    console.log(`📄 Result: ${text.substring(0, 200)}...`);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! Correct service key works!'); 
      console.log('🔧 Need to update .env file with this key');
    } else {
      console.log('\n❌ Still getting error with correct key');
      try {
        const result = JSON.parse(text);
        console.log('Error details:', result);
      } catch (e) {
        console.log('Raw error:', text);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

console.log('🔑 Service Role Key Verification Tool');
console.log('=====================================\n');
testWithCorrectKey();