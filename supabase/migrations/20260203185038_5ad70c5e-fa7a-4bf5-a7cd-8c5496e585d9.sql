-- Add news feed page size setting
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS news_feed_page_size integer DEFAULT 40;