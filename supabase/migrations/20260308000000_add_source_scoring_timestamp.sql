-- Add source_scoring_at timestamp to track when source scoring was created
ALTER TABLE public.news_rss_items
ADD COLUMN IF NOT EXISTS source_scoring_at TIMESTAMP WITH TIME ZONE;

-- Add index for better performance when ordering by scoring time
CREATE INDEX IF NOT EXISTS idx_news_rss_items_source_scoring_at 
ON public.news_rss_items(source_scoring_at DESC);

-- Add comment
COMMENT ON COLUMN public.news_rss_items.source_scoring_at IS 'Timestamp when the source scoring was created/updated';
