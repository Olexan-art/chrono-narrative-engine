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

async function cleanAndRecreateJobs() {
  try {
    console.log('🧹 Cleaning Duplicate Cron Jobs\n');
    console.log('===============================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Checking for duplicates...');
    
    // Get all records grouped by job_name
    const allUrl = `${url}/rest/v1/cron_job_configs?select=*&order=job_name,created_at`;
    const allResponse = await fetch(allUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (!allResponse.ok) {
      throw new Error(`Failed to fetch configs: ${await allResponse.text()}`);
    }
    
    const allConfigs = await allResponse.json();
    console.log(`📋 Found ${allConfigs.length} total config record(s)`);
    
    // Group by job_name and find duplicates
    const jobGroups = {};
    allConfigs.forEach(config => {
      if (!jobGroups[config.job_name]) {
        jobGroups[config.job_name] = [];
      }
      jobGroups[config.job_name].push(config);
    });
    
    const duplicates = Object.keys(jobGroups).filter(jobName => jobGroups[jobName].length > 1);
    console.log(`⚠️ Found ${duplicates.length} job(s) with duplicates:`);
    
    duplicates.forEach(jobName => {
      console.log(`   🔄 ${jobName}: ${jobGroups[jobName].length} copies`);
    });
    
    console.log('\n2️⃣ Removing duplicates (keeping latest)...');
    
    let deleted = 0;
    
    for (const jobName of duplicates) {
      const copies = jobGroups[jobName].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      const toKeep = copies[0]; // Latest
      const toDelete = copies.slice(1); // Others
      
      console.log(`   🔧 ${jobName}: keeping ID ${toKeep.id.substring(0, 8)}..., deleting ${toDelete.length} old copies`);
      
      for (const oldCopy of toDelete) {
        const deleteResponse = await fetch(`${url}/rest/v1/cron_job_configs?id=eq.${oldCopy.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          }
        });
        
        if (deleteResponse.ok) {
          deleted++;
          console.log(`      ✅ Deleted ID ${oldCopy.id.substring(0, 8)}...`);
        } else {
          console.log(`      ❌ Failed to delete ID ${oldCopy.id.substring(0, 8)}...`);
        }
      }
    }
    
    console.log(`\n✅ Cleanup complete: ${deleted} duplicate(s) removed`);
    
    console.log('\n3️⃣ Final job list:');
    const uniqueJobs = Object.keys(jobGroups);
    uniqueJobs.forEach(jobName => {
      const config = jobGroups[jobName][0];
      console.log(`   📋 ${jobName} (${config.frequency_minutes}min, enabled: ${config.enabled})`);
    });
    
    console.log(`\n🎯 Ready to create ${uniqueJobs.filter(job => jobGroups[job][0].enabled).length} enabled jobs`);
    console.log('Run final-create-crons.mjs again to proceed');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

console.log('🚀 Duplicate Job Cleaner');
console.log('========================\n');
cleanAndRecreateJobs();