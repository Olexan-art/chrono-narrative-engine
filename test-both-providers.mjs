#!/usr/bin/env node

// Test both providers to see what's wrong
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testBothProviders() {
  console.log('🔍 Testing both Z.AI and DeepSeek providers...');
  
  try {
    // Test processRetellQueue with both providers
    console.log('\n🔄 Testing processRetellQueue with both providers...');
    const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A`
      },
      body: JSON.stringify({
        action: 'processRetellQueue',
        password: ADMIN_PASSWORD,
        country_code: 'ALL',
        limit: 6,  // Small test
        provider: 'both'  // Test both
      })
    });

    const processResult = await processResponse.json();
    console.log('✅ ProcessRetellQueue result:');
    console.log(JSON.stringify(processResult, null, 2));

    // Test Z.AI provider directly
    console.log('\n🧪 Testing Z.AI directly...');
    const zaiResponse = await fetch(`${SUPABASE_URL}/functions/v1/bulk-retell-news-zai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4`
      },
      body: JSON.stringify({
        country_code: 'US',
        time_range: 'last_24h',
        llm_model: 'GLM-4.7-Flash',
        job_name: 'test_zai_direct',
        trigger: 'manual'
      })
    });

    console.log('Z.AI status:', zaiResponse.status);
    const zaiResult = await zaiResponse.json();
    console.log('Z.AI response:', JSON.stringify(zaiResult, null, 2));

    // Test DeepSeek provider directly
    console.log('\n🧪 Testing DeepSeek directly...');
    const deepseekResponse = await fetch(`${SUPABASE_URL}/functions/v1/bulk-retell-news-deepseek`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4`
      },
      body: JSON.stringify({
        country_code: 'US',
        time_range: 'last_24h',
        llm_model: 'deepseek-chat',
        job_name: 'test_deepseek_direct',
        trigger: 'manual'
      })
    });

    console.log('DeepSeek status:', deepseekResponse.status);
    const deepseekResult = await deepseekResponse.json();
    console.log('DeepSeek response:', JSON.stringify(deepseekResult, null, 2));

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testBothProviders().catch(console.error);