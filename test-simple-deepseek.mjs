#!/usr/bin/env node

// Simple DeepSeek function test
async function testSimpleDeepSeek() {
  console.log('🧪 Testing DeepSeek function directly...');
  
  try {
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';
    
    const response = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-deepseek', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country_code: 'us',
        time_range: 'last_6h',
        llm_model: 'deepseek-chat',
        job_name: 'simple_test',
        trigger: 'manual'
      })
    });

    console.log('Response status:', response.status);
    
    if (response.status === 401) {
      console.log('❌ Still getting 401 - JWT issue');
      const errorText = await response.text();
      console.log('Error response:', errorText);
    } else {
      const result = await response.json();
      console.log('✅ Success! Response:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSimpleDeepSeek().catch(console.error);