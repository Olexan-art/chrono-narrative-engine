import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const getVar = (key) => {
  const match = env.match(new RegExp(`${key}="?([^"\\r\\n]+)"?`));
  return match ? match[1] : null;
};

const supabaseUrl = getVar('VITE_SUPABASE_URL');
const serviceKey = getVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceKey);

const sql = `
ALTER TABLE news_rss_items 
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_model text,
  ADD COLUMN IF NOT EXISTS llm_processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_news_rss_llm_provider 
  ON news_rss_items(llm_provider, llm_processed_at) 
  WHERE llm_provider IS NOT NULL;
`;

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="?([^"\r\n]+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n]+)/)[1];
const supabase = createClient(url, key);

const since = new Date(Date.now() - 24*60*60*1000).toISOString();

const { count: zai } = await supabase.from('news_rss_items')
  .select('id', { count: 'exact', head: true })
  .eq('llm_provider', 'zai')
  .gte('llm_processed_at', since);

const { count: ds } = await supabase.from('news_rss_items')
  .select('id', { count: 'exact', head: true })
  .in('llm_provider', ['deepseek', 'deepseek-fallback'])
  .gte('llm_processed_at', since);

console.log(`Z.AI 24h: ${zai}   DeepSeek 24h: ${ds}`);

