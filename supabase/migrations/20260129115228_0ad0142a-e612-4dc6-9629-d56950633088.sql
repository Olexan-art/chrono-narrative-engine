-- Add new fields to news_rss_items for key points, themes, and keywords
ALTER TABLE public.news_rss_items
ADD COLUMN IF NOT EXISTS key_points JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN public.news_rss_items.key_points IS 'Array of 4-5 key takeaways/thesis points from the article';
COMMENT ON COLUMN public.news_rss_items.themes IS 'Main categories/themes the news covers';
COMMENT ON COLUMN public.news_rss_items.keywords IS 'Search keywords extracted from the text';