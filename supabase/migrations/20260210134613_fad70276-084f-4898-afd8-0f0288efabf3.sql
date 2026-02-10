
-- Add default_image_url column to news_rss_feeds for fallback images
ALTER TABLE public.news_rss_feeds ADD COLUMN IF NOT EXISTS default_image_url TEXT;
