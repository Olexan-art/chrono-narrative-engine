#!/usr/bin/env node

// Test process retell queue to create stats
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testProcessQueue() {
  console.log('🔄 Testing process retell queue...');
  
  try {
    // Process retell queue 
    const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'processRetellQueue',
        password: ADMIN_PASSWORD,
        country_code: 'us',
        limit: 4  // Small test batch
      })
    });

    const processResult = await processResponse.json();
    
    if (processResponse.ok) {
      console.log('✅ processRetellQueue works!');
      console.log('📄 Result:', processResult);
    } else {
      console.log('❌ processRetellQueue failed:');
      console.error(processResult);
    }

    // Wait a moment then check stats again
    console.log('\n⏱️ Waiting 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check stats again
    console.log('\n📊 Checking retell stats after processing...');
    const statsResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',  
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'getRetellStats',
        password: ADMIN_PASSWORD,
        hours: 1
      })
    });

    const statsResult = await statsResponse.json();
    
    if (statsResponse.ok) {
      console.log('✅ Updated statistics:');
      if (statsResult.rows && statsResult.rows.length > 0) {
        statsResult.rows.forEach(row => {
          console.log(`  🤖 Provider: ${row.provider}, Model: ${row.model}, Count: ${row.news_retold}, Job: ${row.job_name}`);
        });
      } else {
        console.log('  ℹ️ Still no stats found');
      }
    } else {
      console.log('❌ getRetellStats failed:');
      console.error(statsResult);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testProcessQueue().catch(console.error);