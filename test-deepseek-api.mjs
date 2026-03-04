#!/usr/bin/env node

// Test DeepSeek API directly 
async function testDeepSeekAPI() {
  console.log('🔑 Testing DeepSeek API...');
  
  try {
    const deepseekKey = 'sk-08d52ed0235a4978b3e09b46c86af077';
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello' }
        ],
        max_tokens: 50
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ DeepSeek API works!');
      console.log('💬 Response:', result.choices?.[0]?.message?.content);
    } else {
      console.log('❌ DeepSeek API failed');
      console.log('Error details:', result);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testDeepSeekAPI().catch(console.error);