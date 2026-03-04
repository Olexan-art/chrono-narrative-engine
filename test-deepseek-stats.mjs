#!/usr/bin/env node

// Test DeepSeek provider in retell stats
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const ADMIN_PASSWORD = '1nuendo19071';

async function testRetellStats() {
  console.log('📊 Testing retell stats with bulk jobs...');
  
  try {
    // Test getRetellStats
    console.log('\n⚡ Testing getRetellStats...');
    const statsResponse = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1ODc1NjcsImV4cCI6MjA0NzE2MzU2N30.rjWUCf5J1KHJ6CQ8EShj6Uv71fJ7Q8o5r3pQRAq_Y6A'}`
      },
      body: JSON.stringify({
        action: 'getRetellStats',
        password: ADMIN_PASSWORD,
        hours: 24
      })
    });

    const statsResult = await statsResponse.json();
    
    if (statsResponse.ok) {
      console.log('✅ getRetellStats works!');
      console.log('📈 Statistics:');
      if (statsResult.rows && statsResult.rows.length > 0) {
        statsResult.rows.forEach(row => {
          console.log(`  Provider: ${row.provider}, Model: ${row.model}, News: ${row.news_retold}, Job: ${row.job_name}`);
        });
      } else {
        console.log('  ℹ️ No stats found (no recent job executions)');
      }
    } else {
      console.log('❌ getRetellStats failed:');
      console.error(statsResult);
    }

    // Also test manual bulk deepseek call to create stats
    console.log('\n🔄 Manual DeepSeek bulk call to create stats...');
    const deepseekResponse = await fetch(`${SUPABASE_URL}/functions/v1/bulk-retell-news-deepseek`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTU4NzU2NywiZXhwIjoyMDQ3MTYzNTY3fQ.Th_LGMI6DnHtQEJ21tOkI2FdNqtEGhtBwmY1CaQcA0g'}`
      },
      body: JSON.stringify({
        country_code: 'us',
        time_range: 'last_24h',
        llm_model: 'deepseek-chat',
        job_name: 'test_deepseek_manual',
        trigger: 'manual'
      })
    });

    const deepseekResult = await deepseekResponse.json();
    console.log('DeepSeek response:', deepseekResult);

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testRetellStats().catch(console.error);