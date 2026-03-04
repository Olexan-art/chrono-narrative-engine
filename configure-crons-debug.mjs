import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

async function callAdminFunction(action, data, password) {
  const url = `${SUPABASE_URL}/functions/v1/admin`;
  const payload = { action, password, data };
  
  console.log(`📤 Calling admin/${action}...`);
  console.log('   Payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  console.log(`   Status: ${response.status}`);
  
  if (!response.ok) {
    console.log(`   ❌ Error response: ${responseText}`);
    throw new Error(`HTTP ${response.status}: ${responseText}`);
  }

  try {
    const result = JSON.parse(responseText);
    console.log('   Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    console.log(`   Response text: ${responseText}`);
    throw new Error('Invalid JSON response');
  }
}

async function main() {
  // Get password from command line arg or environment variable
  let password = process.argv[2] || process.env.ADMIN_PASSWORD;
  
  if (!password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    password = await new Promise(resolve => {
      rl.question('Enter admin password: ', resolve);
    });
    rl.close();
  }

  try {
    console.log('\n🔧 Setting up cron configurations via admin function...\n');

    // Jobs to configure
    const jobs = [
      {
        name: 'retell_recent_usa',
        config: {
          enabled: true,
          frequency_minutes: 15,
          countries: ['us'],
          processing_options: {
            llm_model: 'gpt-4o-mini',
            llm_provider: 'openai',
            country_code: 'us',
            time_range: 'last_24h'
          }
        }
      },
      {
        name: 'retell_india',
        config: {
          enabled: false,
          frequency_minutes: 60,
          countries: ['in'],
          processing_options: { country_code: 'in' }
        }
      },
      {
        name: 'retell_india_deepseek',
        config: {
          enabled: false,
          frequency_minutes: 90
        }
      },
      {
        name: 'retell_india_zai',
        config: {
          enabled: false,
          frequency_minutes: 90
        }
      }
    ];

    for (const job of jobs) {
      try {
        const result = await callAdminFunction(
          'updateCronConfig',
          {
            jobName: job.name,
            config: job.config
          },
          password
        );
        
        if (result.success) {
          console.log(`   ✅ ${job.name}: configured`);
        } else {
          console.log(`   ⚠️ ${job.name}: ${result.error || 'No success flag'}`);
        }
      } catch (err) {
        console.error(`   ❌ ${job.name}: ${err.message}`);
      }
      console.log();
    }

    console.log('✨ Configuration complete!\n');

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
