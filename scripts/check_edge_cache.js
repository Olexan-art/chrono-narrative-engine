// Check if edge cache has news pages

async function checkCache() {
  const urls = [
    'https://chrono-narrative-supabase.functions.supabase.co/ssr-render?path=/news/ua&cache=true',
    'https://chrono-narrative-supabase.functions.supabase.co/ssr-render?path=/news/ua/u-harkovi-budinok&cache=true',
    'https://chrono-narrative-supabase.functions.supabase.co/ssr-render?path=/news/us&cache=true'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      console.log(`\n${url}`);
      console.log(`Status: ${response.status}`);
      
      if (response.status === 200) {
        const text = await response.text();
        console.log(`Content length: ${text.length}`);
        
        // Check for news titles
        const titleMatch = text.match(/<title>(.*?)<\/title>/);
        if (titleMatch) {
          console.log(`Title: ${titleMatch[1]}`);
        }
        
        // Check for article links
        const articleLinks = text.match(/href="\/news\/[^"]+"/g);
        if (articleLinks) {
          console.log(`Found ${articleLinks.length} article links`);
          // Show first few
          articleLinks.slice(0, 3).forEach(link => {
            console.log(`  ${link}`);
          });
        }
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

checkCache();