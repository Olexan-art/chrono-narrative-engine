-- Add slug field to news_rss_items for friendly URLs
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS slug text;

-- Add translation fields for Indian languages
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS title_hi text; -- Hindi
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS title_ta text; -- Tamil
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS title_te text; -- Telugu
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS title_bn text; -- Bengali
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS title_en text; -- English (main)

ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS description_hi text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS description_ta text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS description_te text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS description_bn text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS description_en text;

ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS content_hi text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS content_ta text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS content_te text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS content_bn text;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS content_en text;

-- Add character dialogue for news comments
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS chat_dialogue jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.news_rss_items ADD COLUMN IF NOT EXISTS generated_story_id uuid;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_news_rss_items_slug ON public.news_rss_items(slug);

-- Create unique index for country + slug combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_rss_items_country_slug ON public.news_rss_items(country_id, slug);