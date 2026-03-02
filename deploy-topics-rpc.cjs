const fs = require('fs');

const sql = `
-- Function to efficiently aggregate topic counts directly in the database
-- Replaces fetching 30,000 rows to the client
CREATE OR REPLACE FUNCTION get_trending_topics(item_limit INT DEFAULT 30000)
RETURNS TABLE (topic text, count bigint) 
LANGUAGE SQL
AS $$
  SELECT 
    t.theme as topic,
    COUNT(*) as count
  FROM (
    SELECT unnest(themes) as theme
    FROM news_rss_items
    WHERE themes IS NOT NULL
    ORDER BY published_at DESC
    LIMIT item_limit
  ) t
  WHERE t.theme IS NOT NULL
  GROUP BY t.theme
  ORDER BY count DESC;
$$;
`;

console.log("Please run this in the Supabase Dashboard SQL Editor:");
console.log(sql);
