-- Add news_analysis JSONB field to news_rss_items table
-- to store comprehensive analysis including Why It Matters, Context/Background, What happens Next, and FAQ

ALTER TABLE public.news_rss_items 
ADD COLUMN IF NOT EXISTS news_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN public.news_rss_items.news_analysis IS 'Comprehensive news analysis with why_it_matters, context_background, what_happens_next, and faq fields';
