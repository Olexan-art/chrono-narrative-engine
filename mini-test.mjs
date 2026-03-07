import { writeFileSync } from 'fs';
try {
  const { createClient } = await import('@supabase/supabase-js');
  const { readFileSync } = await import('fs');
  const env = readFileSync('.env', 'utf8');
  const url = env.match(/VITE_SUPABASE_URL="?([^"\r\n]+)/)[1];
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n]+)/)[1];
  const sb = createClient(url, key);

  // Clean up test-direct record
  await sb.from('news_rss_items').update({ llm_provider: null, llm_processed_at: null }).eq('llm_provider', 'test-direct');

  const since24h = new Date(Date.now()-86400000).toISOString();
  const { count: zaiCount } = await sb.from('news_rss_items').select('id',{count:'exact',head:true}).eq('llm_provider','zai').gte('llm_processed_at', since24h);
  const { count: dsCount } = await sb.from('news_rss_items').select('id',{count:'exact',head:true}).in('llm_provider',['deepseek','deepseek-fallback']).gte('llm_processed_at', since24h);
  const { count: total } = await sb.from('news_rss_items').select('id',{count:'exact',head:true}).not('llm_provider','is',null).gte('llm_processed_at', since24h);
  
  const { data: providers } = await sb.from('news_rss_items').select('llm_provider').not('llm_provider','is',null).limit(200);
  const grouped = {};
  for (const p of providers||[]) grouped[p.llm_provider] = (grouped[p.llm_provider]||0)+1;

  const lines = [
    `Stats 24h: Z.AI=${zaiCount}  DeepSeek=${dsCount}  Total=${total}`,
    `All providers: ${JSON.stringify(grouped)}`
  ];
  writeFileSync('mini-result.txt', lines.join('\n'));
} catch(e) {
  writeFileSync('mini-result.txt', 'ERROR: ' + e.message);
}
