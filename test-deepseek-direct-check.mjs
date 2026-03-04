#!/usr/bin/env node

// Check if there are news items to process and test direct DeepSeek call
const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';

async function checkAndTestDeepSeek() {
  console.log('🔍 Checking news items without key_points...');
  
  try {
    // Create Supabase client to check data
    const response = await fetch(`${SUPABASE_URL}/rest/v1/news_rss_items?select=id,title,country:news_countries(code)&key_points=is.null&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    });

    const newsItems = await response.json();
    console.log('📰 Found news items without key_points:', newsItems.length);
    
    if (newsItems.length > 0) {
      console.log('Sample:', newsItems.slice(0, 2).map(item => ({
        id: item.id, 
        title: item.title?.substring(0, 50) + '...',
        country: item.country?.code
      })));
      
      // Try direct DeepSeek call on specific country 
      const usItems = newsItems.filter(item => item.country?.code === 'us');
      if (usItems.length > 0) {
        console.log('\n🇺🇸 Found US items, testing direct DeepSeek call...');
        
        const deepseekResponse = await fetch(`${SUPABASE_URL}/functions/v1/bulk-retell-news-deepseek`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            country_code: 'us',
            time_range: 'last_24h',
            llm_model: 'deepseek-chat',
            job_name: 'direct_test',
            trigger: 'manual'
          })
        });

        console.log('DeepSeek response status:', deepseekResponse.status);
        const deepseekResult = await deepseekResponse.json();
        console.log('DeepSeek response:', JSON.stringify(deepseekResult, null, 2));
      }
    } else {
      console.log('ℹ️ No news items found without key_points');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

checkAndTestDeepSeek().catch(console.error);