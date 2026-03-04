#!/usr/bin/env node

// Test DeepSeek function directly with item
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A';

async function testDeepSeekFunction() {
  console.log('🧪 Testing DeepSeek function with debugging...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/bulk-retell-news-deepseek`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country_code: 'us',
        time_range: 'last_24h',
        llm_model: 'deepseek-chat',
        job_name: 'test_debug',
        trigger: 'manual'
      })
    });

    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Function called successfully!');
    } else {
      console.log('❌ Function call failed');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testDeepSeekFunction().catch(console.error);