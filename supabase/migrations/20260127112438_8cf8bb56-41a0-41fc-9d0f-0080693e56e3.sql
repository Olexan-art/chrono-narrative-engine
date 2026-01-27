-- Create table to store sitemap metadata
CREATE TABLE public.sitemap_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sitemap_type text NOT NULL, -- 'main', 'news-us', 'news-ua', 'news-pl', 'news-in'
  country_code text, -- null for main sitemap
  url_count integer NOT NULL DEFAULT 0,
  last_generated_at timestamp with time zone,
  generation_time_ms integer, -- how long it took to generate
  file_size_bytes integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sitemap_type)
);

-- Enable RLS
ALTER TABLE public.sitemap_metadata ENABLE ROW LEVEL SECURITY;

-- Anyone can read sitemap metadata
CREATE POLICY "Anyone can read sitemap metadata" 
ON public.sitemap_metadata 
FOR SELECT 
USING (true);

-- Service can manage sitemap metadata
CREATE POLICY "Service can manage sitemap metadata" 
ON public.sitemap_metadata 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_sitemap_metadata_type ON public.sitemap_metadata(sitemap_type);
CREATE INDEX idx_sitemap_metadata_country ON public.sitemap_metadata(country_code);