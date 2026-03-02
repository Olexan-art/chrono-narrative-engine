-- Migration to add source_scoring to news_rss_items
ALTER TABLE public.news_rss_items
ADD COLUMN IF NOT EXISTS source_scoring JSONB;

-- Add a comment to describe what this column stores
COMMENT ON COLUMN public.news_rss_items.source_scoring IS 'Stores the output of the News Scoring Engine, including the JSON validation metrics and the generated HTML widget.';
