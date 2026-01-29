-- Add English versions of key_points and themes for bilingual display
ALTER TABLE public.news_rss_items
ADD COLUMN IF NOT EXISTS key_points_en JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS themes_en TEXT[] DEFAULT NULL;