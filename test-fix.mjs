#!/usr/bin/env node

// Test fix for "Country ALL not found" error
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testQueue() {
  console.log('🧪 Testing queue fix...');
  
  try {
    console.log('\n⚡ Testing processRetellQueue...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A'}`
      },
      body: JSON.stringify({
        action: 'processRetellQueue',
        password: ADMIN_PASSWORD,
        provider: 'both',
        batch_size: 5,
        timeout_minutes: 2
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ processRetellQueue works!');
      console.log('📊 Results:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ processRetellQueue failed:');
      console.error(result);
    }
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testQueue().catch(console.error);