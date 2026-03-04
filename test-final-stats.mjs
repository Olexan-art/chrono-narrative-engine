#!/usr/bin/env node

// Test retell stats to see if we have any activity
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testStats() {
  console.log('📊 Testing retell stats...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'getRetellStats', 
        password: ADMIN_PASSWORD,
        hours: 24
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Stats work!');
      if (result.rows && result.rows.length > 0) {
        console.log('📈 Statistics data:');
        result.rows.forEach(row => {
          console.log(`  🤖 ${row.provider} (${row.model}): ${row.news_retold} новин | Job: ${row.job_name}`);
        });
      } else {
        console.log('📈 No statistics data found');
      }

      console.log('\n📄 Raw response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Stats failed:');
      console.error(result);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testStats().catch(console.error);