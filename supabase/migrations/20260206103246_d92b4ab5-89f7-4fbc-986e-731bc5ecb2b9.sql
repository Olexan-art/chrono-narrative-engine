-- Add sample_ratio column to news_rss_feeds to control how many news items to take
-- 1 = all news, 2 = every 2nd, 3 = every 3rd, etc.
ALTER TABLE public.news_rss_feeds 
ADD COLUMN sample_ratio integer NOT NULL DEFAULT 1;

-- Add check constraint to ensure valid values (1-10)
ALTER TABLE public.news_rss_feeds 
ADD CONSTRAINT news_rss_feeds_sample_ratio_check CHECK (sample_ratio >= 1 AND sample_ratio <= 10);

-- Add comment for documentation
COMMENT ON COLUMN public.news_rss_feeds.sample_ratio IS 'Sample ratio: 1=all items, 2=every 2nd, 3=every 3rd, etc.';