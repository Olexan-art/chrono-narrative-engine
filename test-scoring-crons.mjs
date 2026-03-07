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

const providers = [
  { name: 'Z.AI', provider: 'zai', model: 'GLM-4.7-Flash' },
  { name: 'Gemini', provider: 'gemini', model: 'gemini-2.5-flash' },
  { name: 'DeepSeek', provider: 'deepseek', model: 'deepseek-chat' },
  { name: 'OpenAI', provider: 'openai', model: 'gpt-4o-mini' }
];

async function testScoring(providerName, provider, model, testNum) {
  console.log(`\n🧪 Test ${testNum} - ${providerName} (${model})`);
  
  const requestBody = {
    auto_select: true,
    model: model,
    provider: provider
  };
  
  console.log(`📤 Request body:`, JSON.stringify(requestBody));
  
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
    console.log(`📥 Response (${response.status}):`, responseText.substring(0, 300));

    if (!response.ok) {
      console.error(`❌ Failed (${response.status})`);
      return false;
    }

    const result = JSON.parse(responseText);
    
    if (result.success) {
      const overall = result.scoring?.json?.scores?.overall || 0;
      const status = result.scoring?.json?.verification_status || 'Unknown';
      console.log(`✅ Success - Score: ${overall}, Status: ${status}`);
      return true;
    } else {
      console.error(`❌ Failed:`, result.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Source Scoring with all LLM providers\n');
  console.log('='.repeat(60));

  const results = {
    total: 0,
    success: 0,
    failed: 0
  };

  for (const { name, provider, model } of providers) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${name} Provider`);
    console.log('='.repeat(60));

    // Run 2 tests for each provider
    for (let i = 1; i <= 2; i++) {
      results.total++;
      const success = await testScoring(name, provider, model, i);
      
      if (success) {
        results.success++;
      } else {
        results.failed++;
      }

      // Wait 2 seconds between tests to avoid rate limits
      if (i < 2) {
        console.log('⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Wait 3 seconds between different providers
    console.log('\n⏳ Waiting 3 seconds before testing next provider...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.total}`);
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success rate: ${Math.round((results.success / results.total) * 100)}%`);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
