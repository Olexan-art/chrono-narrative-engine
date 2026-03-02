-- Optimize bulk-retell-news queue
CREATE INDEX IF NOT EXISTS idx_news_rss_items_retell_queue 
ON public.news_rss_items (country_id, fetched_at DESC) 
WHERE key_points IS NULL;
