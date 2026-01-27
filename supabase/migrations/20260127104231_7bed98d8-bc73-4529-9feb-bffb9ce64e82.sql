-- Add archiving columns to news_rss_items
ALTER TABLE public.news_rss_items 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_news_rss_items_archived ON public.news_rss_items(is_archived);
CREATE INDEX IF NOT EXISTS idx_news_rss_items_archived_at ON public.news_rss_items(archived_at);

-- Add archive settings to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS news_archive_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS news_auto_archive_enabled boolean DEFAULT true;