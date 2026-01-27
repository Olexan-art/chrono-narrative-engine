-- Add tweets column to news_rss_items for pseudo-tweets functionality
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS tweets jsonb DEFAULT '[]'::jsonb;

-- Create index for better performance when filtering by tweets
CREATE INDEX IF NOT EXISTS idx_news_rss_items_tweets ON public.news_rss_items USING gin(tweets);