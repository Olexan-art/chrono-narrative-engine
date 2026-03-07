import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const log = [];
const L = (...args) => { const s = args.join(' '); console.log(s); log.push(s); };

try {
  const env = readFileSync('.env', 'utf8');
  const url = env.match(/VITE_SUPABASE_URL="?([^"\r\n]+)/)[1];
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n]+)/)[1];
  const anonKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)/)[1];
  L('url='+url, 'anonKey='+anonKey?.slice(0,20)+'...' );
  const supabase = createClient(url, key);

  // === BEFORE/AFTER TEST ===
  const { data: beforeItems, error: bErr } = await supabase.from('news_rss_items')
    .select('id, key_points, llm_provider')
    .is('key_points', null)
    .gte('fetched_at', new Date(Date.now() - 1*60*60*1000).toISOString())
    .limit(3);

  L('bErr='+JSON.stringify(bErr));
  L('BEFORE (pending items found: '+(beforeItems?.length||0)+'):');
  for (const item of beforeItems || []) {
    L(`  ${item.id}: key_points=${item.key_points ? 'SET' : 'NULL'}  llm_provider=${item.llm_provider}`);
  }

  if (!beforeItems || beforeItems.length === 0) {
    L('No pending items found - nothing to test!');
    writeFileSync('result.txt', log.join('\n'));
    process.exit(0);
  }

  L('\nCalling bulk-retell-news-zai...');
  const resp = await fetch(`${url}/functions/v1/bulk-retell-news-zai`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ country_code: 'US', time_range: 'last_1h' })
  });
  const result = await resp.json();
  L('Function result:', JSON.stringify(result).slice(0, 300));

  const ids = beforeItems.map(i => i.id);
  const { data: afterItems } = await supabase.from('news_rss_items')
    .select('id, key_points, llm_provider, llm_processed_at')
    .in('id', ids);

  L('\nAFTER:');
  for (const item of afterItems || []) {
    L(`  ${item.id}: key_points=${item.key_points ? 'SET' : 'NULL'}  llm_provider=${item.llm_provider}  processed_at=${item.llm_processed_at}`);
  }
} catch(e) {
  L('CRASH:', e.message, e.stack);
}
writeFileSync('result.txt', log.join('\n'));
