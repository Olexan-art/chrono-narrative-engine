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

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing with specific newsId (manual mode)\n');

const requestBody = {
  newsId: '454b36d6-624d-4e45-826f-46102c332a3f', // Seattle Sounders
  model: 'GLM-4.7-Flash',
  provider: 'zai'
};

console.log('📤 Request:', JSON.stringify(requestBody, null, 2));

try {
  const response = await fetch(`${url}/functions/v1/score-news-source`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  
  console.log(`\n📥 Status: ${response.status}`);
  
  if (response.ok) {
    const result = JSON.parse(responseText);
    if (result.success) {
      console.log('✅ SUCCESS!');
      console.log(`Score: ${result.scoring?.json?.scores?.overall || 'N/A'}`);
      console.log(`Status: ${result.scoring?.json?.verification_status || 'N/A'}`);
    } else {
      console.log('Response:', responseText.substring(0, 500));
    }
  } else {
    console.log('❌ Failed:', responseText);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
