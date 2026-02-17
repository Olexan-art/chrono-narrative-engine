-- 1. Remove duplicate items, keeping only the oldest one per URL
DELETE FROM news_rss_items
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY url ORDER BY fetched_at ASC) as row_num
    FROM news_rss_items
  ) t
  WHERE t.row_num > 1
);

-- 2. Drop the old unique constraint (feed_id + url)
ALTER TABLE news_rss_items DROP CONSTRAINT IF EXISTS news_rss_items_feed_id_url_key;

-- 3. Add new unique constraint on URL only
ALTER TABLE news_rss_items ADD CONSTRAINT news_rss_items_url_key UNIQUE (url);
