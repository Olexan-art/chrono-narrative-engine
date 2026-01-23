-- Add translation columns to parts table
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS title_en TEXT,
ADD COLUMN IF NOT EXISTS title_pl TEXT,
ADD COLUMN IF NOT EXISTS content_en TEXT,
ADD COLUMN IF NOT EXISTS content_pl TEXT;

-- Add translation columns to chapters table
ALTER TABLE public.chapters 
ADD COLUMN IF NOT EXISTS title_en TEXT,
ADD COLUMN IF NOT EXISTS title_pl TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_pl TEXT,
ADD COLUMN IF NOT EXISTS narrator_monologue_en TEXT,
ADD COLUMN IF NOT EXISTS narrator_monologue_pl TEXT,
ADD COLUMN IF NOT EXISTS narrator_commentary_en TEXT,
ADD COLUMN IF NOT EXISTS narrator_commentary_pl TEXT;

-- Add translation columns to volumes table
ALTER TABLE public.volumes 
ADD COLUMN IF NOT EXISTS title_en TEXT,
ADD COLUMN IF NOT EXISTS title_pl TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS description_pl TEXT,
ADD COLUMN IF NOT EXISTS summary_en TEXT,
ADD COLUMN IF NOT EXISTS summary_pl TEXT;

-- Add SEO columns to parts table
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- Add SEO columns to chapters table
ALTER TABLE public.chapters 
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];