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

console.log('🔍 Quick Gemini auto_select test\n');

const requestBody = {
  auto_select: true,
  model: 'gemini-2.5-flash',
  provider: 'gemini'
};

console.log('📤 Request:', JSON.stringify(requestBody, null, 2));

const response = await fetch(`${url}/functions/v1/score-news-source`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`
  },
  body: JSON.stringify(requestBody)
});

const data = await response.json();

console.log(`\n📥 Status: ${response.status}`);
console.log('📥 Response:', JSON.stringify(data, null, 2));

if (response.ok && data.success) {
  const score = data.scoring?.json?.verification_score?.overall || 'N/A';
  const status = data.scoring?.json?.verification_status || 'N/A';
  console.log(`\n✅ SUCCESS!`);
  console.log(`Score: ${score}`);
  console.log(`Status: ${status}`);
} else {
  console.log(`\n❌ FAILED`);
}
