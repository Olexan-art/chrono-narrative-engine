-- Add per-country retell ratio to news_countries
ALTER TABLE public.news_countries 
ADD COLUMN IF NOT EXISTS retell_ratio integer DEFAULT 100;

-- Set default values: 100% for USA/UA, 20% for others
UPDATE public.news_countries SET retell_ratio = 100 WHERE code IN ('US', 'UA');
UPDATE public.news_countries SET retell_ratio = 20 WHERE code NOT IN ('US', 'UA');

-- Add ping tracking columns to sitemap_metadata
ALTER TABLE public.sitemap_metadata 
ADD COLUMN IF NOT EXISTS last_ping_at timestamptz,
ADD COLUMN IF NOT EXISTS google_ping_success boolean,
ADD COLUMN IF NOT EXISTS bing_ping_success boolean;

-- Add comment for clarity
COMMENT ON COLUMN public.news_countries.retell_ratio IS 'Percentage of news items to auto-retell (1-100)';