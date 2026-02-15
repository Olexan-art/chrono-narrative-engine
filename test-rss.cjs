const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use Service Role Key if available (for backend/admin tasks), otherwise Anon Key (client)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const parser = new Parser();

async function testRSSFetch() {
  console.log('Testing RSS Fetch...');

  try {
    // 1. Fetch active feeds
    const { data: feeds, error } = await supabase
      .from('news_rss_feeds')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error fetching feeds from Supabase:', error.message);
      return;
    }

    if (!feeds || feeds.length === 0) {
      console.log('No active feeds found in database.');
      return;
    }

    const feed = feeds[0];
    console.log(`Found feed: ${feed.name} (${feed.url})`);

    // 2. Fetch RSS content
    console.log(`Fetching RSS from ${feed.url}...`);
    const feedContent = await parser.parseURL(feed.url);

    console.log(`Successfully fetched ${feedContent.items.length} items.`);
    if (feedContent.items.length > 0) {
      const firstItem = feedContent.items[0];
      console.log('Sample item:', {
        title: firstItem.title,
        link: firstItem.link,
        pubDate: firstItem.pubDate
      });
    }

    console.log('RSS Fetch test completed successfully (read-only).');

  } catch (err) {
    console.error('Test failed:', err);
  }
}

testRSSFetch();
