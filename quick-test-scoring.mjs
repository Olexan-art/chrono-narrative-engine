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

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

console.log('🔍 Quick test of Z.AI source scoring\n');

const requestBody = {
  auto_select: true,
  model: 'GLM-4.7-Flash',
  provider: 'zai'
};

console.log('📤 Request:', JSON.stringify(requestBody, null, 2));
console.log(`🌐 URL: ${url}/functions/v1/score-news-source\n`);

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
  
  console.log(`📥 Status: ${response.status}`);
  console.log(`📥 Response:\n`, responseText);
  
  if (response.ok) {
    const result = JSON.parse(responseText);
    if (result.success) {
      console.log('\n✅ Success!');
      console.log(`Score: ${result.scoring?.json?.scores?.overall || 'N/A'}`);
      console.log(`Status: ${result.scoring?.json?.verification_status || 'N/A'}`);
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
