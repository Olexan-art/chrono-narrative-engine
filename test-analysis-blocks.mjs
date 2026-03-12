// Test script to verify auto-cache functionality for news analysis blocks
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function testAnalysisBlocksAndCache() {
  console.log('🔬 Testing Analysis Blocks and Auto-Cache System');
  console.log('================================================');
  
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Find a recent news item to test with
  console.log('\n1. Finding recent news item...');
  const { data: newsItems, error } = await supabase
    .from('news_rss_items')
    .select('id, slug, title, country:news_countries(code)')
    .limit(3)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  if (!newsItems || newsItems.length === 0) {
    console.log('❌ No news items found');
    return;
  }

  const testItem = newsItems[0];
  console.log(`✅ Testing with: ${testItem.title?.slice(0, 50)}... (ID: ${testItem.id})`);

  // 2. Test generating analysis with new format
  console.log('\n2. Testing analysis generation...');
  
  const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/generate-news-analysis`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      newsId: testItem.id,
      newsTitle: testItem.title || 'Test News',
      newsContent: testItem.title + ' - This is test content for analysis generation.',
      model: 'deepseek-chat'
    })
  });

  const analysisResult = await analysisResponse.json();
  
  if (analysisResult.success) {
    console.log('✅ Analysis generated successfully');
  } else {
    console.log('❌ Analysis generation failed:', analysisResult.error);
  }

  // 3. Check if the generated analysis has new fields
  console.log('\n3. Checking analysis structure...');
  
  const { data: updatedItem } = await supabase
    .from('news_rss_items')
    .select('news_analysis')
    .eq('id', testItem.id)
    .single();

  const analysis = updatedItem?.news_analysis;
  
  if (analysis) {
    const fields = [
      'key_takeaways',
      'why_it_matters', 
      'context_background',
      'what_happens_next',
      'faq',
      'mentioned_entities',
      'source'
    ];

    console.log('📊 Analysis structure:');
    fields.forEach(field => {
      const value = analysis[field];
      const status = value ? '✅' : '❌';
      const summary = Array.isArray(value) ? `${value.length} items` : 
                     typeof value === 'string' ? `${value.length} chars` :
                     typeof value === 'object' ? 'object' : 
                     'missing';
      console.log(`   ${status} ${field}: ${summary}`);
    });
  }

  // 4. Test manual cache refresh
  console.log('\n4. Testing cache refresh...');
  const country = (testItem.country as any)?.code?.toLowerCase() || 'us';
  const newsPath = `/news/${country}/${testItem.slug}`;
  
  const adminPass = Deno.env.get('ADMIN_PASSWORD')!;
  const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(newsPath)}&password=${adminPass}`;
  
  const cacheResponse = await fetch(cacheUrl, {
    headers: { 'Authorization': `Bearer ${serviceKey}` }
  });

  if (cacheResponse.ok) {
    const cacheResult = await cacheResponse.json();
    console.log(`✅ Cache refreshed: ${cacheResult.success ? 'Success' : cacheResult.error}`);
  } else {
    console.log(`❌ Cache refresh failed: HTTP ${cacheResponse.status}`);
  }

  // 5. Verify SSR content includes new blocks
  console.log('\n5. Testing SSR content...');
  
  const ssrResponse = await fetch(`https://bravennow.com${newsPath}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
  });

  if (ssrResponse.ok) {
    const ssrContent = await ssrResponse.text();
    
    const blocksToCheck = [
      { name: 'Key Takeaways', terms: ['Key Takeaways', 'Ключові висновки'] },
      { name: 'Why It Matters', terms: ['Why It Matters', 'Чому це важливо'] },
      { name: 'Context & Background', terms: ['Context & Background', 'Контекст та передісторія'] },
      { name: 'What Happens Next', terms: ['What Happens Next', 'Що далі'] },
      { name: 'FAQ', terms: ['Frequently Asked Questions', 'Часті запитання'] },
      { name: 'Mentioned Entities', terms: ['Mentioned Entities', 'Згадані суб\'єкти'] },
      { name: 'Source', terms: ['Source', 'Джерело'] }
    ];

    console.log('📄 SSR content analysis:');
    blocksToCheck.forEach(block => {
      const found = block.terms.some(term => ssrContent.includes(term));
      console.log(`   ${found ? '✅' : '❌'} ${block.name}: ${found ? 'Present' : 'Missing'}`);
    });

    console.log(`\n📊 SSR page size: ${ssrContent.length} characters`);
  } else {
    console.log(`❌ SSR test failed: HTTP ${ssrResponse.status}`);
  }

  console.log('\n🎉 Testing complete!');
  console.log(`📰 Test URL: https://bravennow.com${newsPath}`);
}

// Run the test
testAnalysisBlocksAndCache().catch(console.error);