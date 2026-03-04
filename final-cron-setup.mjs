#!/usr/bin/env node

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

async function configureAllCrons() {
  console.log('🔧 Configuring all cron jobs via admin API\n');
  
  const jobs = [
    {
      jobName: 'retell_recent_usa',
      config: { enabled: true, frequency_minutes: 15, countries: ['us'] }
    },
    {
      jobName: 'retell_india',
      config: { enabled: false, frequency_minutes: 60, countries: ['in'] }
    },
    {
      jobName: 'retell_india_deepseek',
      config: { enabled: false, frequency_minutes: 90 }
    },
    {
      jobName: 'retell_india_zai',
      config: { enabled: false, frequency_minutes: 90 }
    }
  ];
  
  for (const job of jobs) {
    await configureJob(job.jobName, job.config);
    await new Promise(r => setTimeout(r, 500)); // 500ms between requests
  }
  
  console.log('\n✨ Done!');
}

async function configureJob(jobName, config) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/admin`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        action: 'updateCronConfig',
        password: '1nuendo19071',
        data: { jobName, config }
      }),
      timeout: 10000
    });

    const status = response.status;
    const statusText = response.statusText;
    
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${jobName}: HTTP ${status} ${statusText}`);
    
    if (status !== 200) {
      const text = await response.text();
      if (text) console.log(`   Response: ${text.substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`❌ ${jobName}: ${error.message}`);
  }
}

configureAllCrons().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
