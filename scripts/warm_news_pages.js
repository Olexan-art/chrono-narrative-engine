// Warm specific news pages for testing
const BASE_URL = 'https://bravennow.com';
const SSR_URL = 'https://chrono-narrative-supabase.functions.supabase.co/ssr-render';

async function warmNewsPages() {
  console.log('Starting news pages cache warming...');
  
  // Get news from country pages
  const countryPages = ['/news/ua', '/news/us', '/news/pl'];
  let allNewsLinks = [];
  
  for (const countryPage of countryPages) {
    try {
      console.log(`\nFetching ${countryPage}...`);
      const response = await fetch(BASE_URL + countryPage);
      
      if (response.status === 200) {
        const html = await response.text();
        // Extract news links for this country
        const newsLinks = html.match(/href="(\/news\/[a-z]{2}\/[^"]+)"/g) || [];
        const uniqueLinks = [...new Set(newsLinks.map(link => 
          link.replace('href="', '').replace('"', '')
        ))];
        console.log(`  Found ${uniqueLinks.length} news links`);
        allNewsLinks.push(...uniqueLinks);
      }
    } catch (error) {
      console.error(`  Error fetching ${countryPage}: ${error.message}`);
    }
  }
  
  // Remove duplicates
  const uniqueLinks = [...new Set(allNewsLinks)];
  console.log(`\nTotal unique news links: ${uniqueLinks.length}`);
  
  try {
    // Warm first 10 news pages
    const linksToWarm = uniqueLinks.slice(0, 10);
    
    for (const link of linksToWarm) {
      console.log(`\nWarming: ${link}`);
      
      // 1. Warm SSR with cache=true
      try {
        const ssrCacheUrl = `${SSR_URL}?path=${encodeURIComponent(link)}&cache=true`;
        console.log('  SSR cache=true...');
        const ssrCacheResponse = await fetch(ssrCacheUrl);
        console.log(`  Status: ${ssrCacheResponse.status}`);
      } catch (error) {
        console.error(`  SSR cache error: ${error.message}`);
      }
      
      // 2. Warm edge cache
      try {
        console.log('  Edge cache...');
        const edgeResponse = await fetch(`${BASE_URL}${link}`);
        console.log(`  Status: ${edgeResponse.status}`);
        
        // Check if new blocks are present
        if (edgeResponse.status === 200) {
          const content = await edgeResponse.text();
          const hasVerifiedBadge = content.includes('data-section="verified-badge"');
          const hasSourceBlock = content.includes('data-section="source"');
          const hasMentionedEntities = content.includes('data-section="mentioned-entities"');
          
          console.log('  Content check:');
          console.log(`    Verified Badge: ${hasVerifiedBadge ? '✓' : '✗'}`);
          console.log(`    Source Block: ${hasSourceBlock ? '✓' : '✗'}`);
          console.log(`    Mentioned Entities: ${hasMentionedEntities ? '✓' : '✗'}`);
        }
      } catch (error) {
        console.error(`  Edge cache error: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\nNews pages warming complete!');
    console.log('\nTo check manually, visit:');
    linksToWarm.slice(0, 3).forEach(link => {
      console.log(`  ${BASE_URL}${link}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

warmNewsPages();