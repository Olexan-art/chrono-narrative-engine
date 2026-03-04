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

async function checkCronStatus() {
  try {
    console.log('📊 CHECKING CRON STATUS');
    console.log('========================\n');
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('1️⃣ Checking cron_job_events for recent activity...');
    
    // Check for recent events
    const eventsResponse = await fetch(`${url}/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=20`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (eventsResponse.ok) {
      const events = await eventsResponse.json();
      console.log(`📊 Found ${events.length} recent events:`);
      
      const finalEvents = events.filter(e => e.job_name === 'retell_recent_usa_final');
      console.log(`🇺🇸 retell_recent_usa_final events: ${finalEvents.length}`);
      
      if (events.length > 0) {
        console.log('\nRecent events:');
        events.slice(0, 10).forEach((event, index) => {
          const time = new Date(event.created_at).toLocaleString('uk-UA');
          console.log(`${index + 1}. [${time}] ${event.job_name || 'unknown'} - ${event.event_type}`);
        });
      }
      
      if (finalEvents.length > 0) {
        console.log('\n🎉 SUCCESS! retell_recent_usa_final job has activity!');
        finalEvents.forEach((event, index) => {
          const time = new Date(event.created_at).toLocaleString('uk-UA');
          console.log(`${index + 1}. [${time}] ${event.event_type} (${event.origin})`);
          if (event.details) {
            const details = JSON.stringify(event.details);
            console.log(`   Details: ${details.substring(0, 100)}${details.length > 100 ? '...' : ''}`);
          }
        });
      }
    }
    
    console.log('\n2️⃣ Testing direct bulk-retell-news call...');
    
    // Test direct call to confirm function works  
    const testResponse = await fetch(`${url}/functions/v1/bulk-retell-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        country_code: 'US',
        time_range: 'last_3_hours',
        job_name: 'status_check_test'
      })
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.text();
      console.log(`✅ Direct call works: ${testResult.substring(0, 200)}...`);
    } else {
      console.log(`❌ Direct call failed: ${testResponse.status} - ${await testResponse.text()}`);
      
      // Try alternative format
      console.log('   💡 Trying alternative format...');
      const altResponse = await fetch(`${url}/functions/v1/bulk-retell-news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          country_code: 'us',
          time_range: '3'
        })
      });
      
      if (altResponse.ok) {
        const altResult = await altResponse.text();
        console.log(`✅ Alternative format works: ${altResult.substring(0, 200)}...`);
      } else {
        console.log(`❌ Alternative format failed: ${altResponse.status} - ${await altResponse.text()}`);
      }
    }
    
    console.log('\n3️⃣ Overall status check...');
    
    // Summary check
    const recentFinalEvents = events.filter(e => {
      const eventTime = new Date(e.created_at);
      const now = new Date();
      const diffMinutes = (now - eventTime) / (1000 * 60);
      return e.job_name === 'retell_recent_usa_final' && diffMinutes <= 30;
    });
    
    if (recentFinalEvents.length > 0) {
      console.log('🎊 CRON SYSTEM IS WORKING!');
      console.log(`✅ Found ${recentFinalEvents.length} recent executions of retell_recent_usa_final`);
      console.log('🔄 Job is running automatically every 15 minutes');  
      console.log('📊 Monitor with: SELECT * FROM cron_job_events WHERE job_name = \'retell_recent_usa_final\' ORDER BY created_at DESC;');
    } else {
      console.log('⚠️ Cron job may be created but not executing yet');
      console.log('🔄 Wait up to 15 minutes for next automatic execution');
      console.log('📊 Check cron_job_events table periodically');
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  }
}

console.log('📊 Cron Status Checker');
console.log('======================\n');
checkCronStatus();