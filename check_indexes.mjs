import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.+)"/)[1];
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.+)"/)[1];

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.rpc('exec_sql', { sql: "CREATE INDEX IF NOT EXISTS idx_news_rss_items_retell_queue ON public.news_rss_items (country_id, fetched_at DESC) WHERE key_points IS NULL;" });
    if (error) console.error("Error executing RPC:", error);
    else console.log(data);
}
run();
