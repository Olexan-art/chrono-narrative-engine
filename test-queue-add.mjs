#!/usr/bin/env node

// Check queue and add items for testing
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function manageQueue() {
  console.log('🔍 Checking retell queue...');
  
  try {
    // Get queue count 
    const queueResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'getQueueCount',
        password: ADMIN_PASSWORD
      })
    });

    const queueResult = await queueResponse.json();
    console.log('📦 Queue count:', queueResult);

    // Add items to queue for US
    console.log('\n🔄 Adding items to retell queue...');
    const addResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'addToRetellQueue',
        password: ADMIN_PASSWORD,
        country_code: 'us',
        count: 4  // Just 4 items for testing
      })
    });

    const addResult = await addResponse.json();
    console.log('➕ Add to queue result:', addResult);

    // Check queue after adding
    const queueResponse2 = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'getQueueCount',
        password: ADMIN_PASSWORD
      })
    });

    const queueResult2 = await queueResponse2.json();
    console.log('📦 Queue count after adding:', queueResult2);

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

manageQueue().catch(console.error);