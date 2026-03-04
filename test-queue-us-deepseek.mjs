#!/usr/bin/env node

// Test processRetellQueue with specific country
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testProcessQueueSpecific() {
  console.log('🔄 Testing process retell queue with US country...');
  
  try {
    // Process retell queue with specific country
    const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'processRetellQueue',
        password: ADMIN_PASSWORD,
        country_code: 'us',  // Specific country instead of ALL
        limit: 2,  // Just 2 items
        provider: 'deepseek'  // Only DeepSeek
      })
    });

    const processResult = await processResponse.json();
    
    if (processResponse.ok) {
      console.log('✅ processRetellQueue (us, deepseek only) works!');
      console.log('📄 Result:', JSON.stringify(processResult, null, 2));
    } else {
      console.log('❌ processRetellQueue failed:');
      console.error(processResult);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testProcessQueueSpecific().catch(console.error);