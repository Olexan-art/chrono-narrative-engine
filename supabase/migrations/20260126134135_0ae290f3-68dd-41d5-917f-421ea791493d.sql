-- Create table for news countries/regions
CREATE TABLE public.news_countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  name_pl TEXT,
  flag TEXT NOT NULL DEFAULT '🌍',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for RSS feeds
CREATE TABLE public.news_rss_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id UUID NOT NULL REFERENCES public.news_countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  fetch_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for RSS news items
CREATE TABLE public.news_rss_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id UUID NOT NULL REFERENCES public.news_rss_feeds(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.news_countries(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feed_id, url)
);

-- Create indexes for better performance
CREATE INDEX idx_news_rss_items_country_id ON public.news_rss_items(country_id);
CREATE INDEX idx_news_rss_items_published_at ON public.news_rss_items(published_at DESC);
CREATE INDEX idx_news_rss_items_category ON public.news_rss_items(category);
CREATE INDEX idx_news_rss_feeds_country_id ON public.news_rss_feeds(country_id);

-- Enable RLS
ALTER TABLE public.news_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_rss_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for news_countries
CREATE POLICY "Anyone can read news countries" ON public.news_countries FOR SELECT USING (true);
CREATE POLICY "Service can manage news countries" ON public.news_countries FOR ALL USING (true);

-- RLS policies for news_rss_feeds
CREATE POLICY "Anyone can read active RSS feeds" ON public.news_rss_feeds FOR SELECT USING (true);
CREATE POLICY "Service can manage RSS feeds" ON public.news_rss_feeds FOR ALL USING (true);

-- RLS policies for news_rss_items
CREATE POLICY "Anyone can read RSS items" ON public.news_rss_items FOR SELECT USING (true);
CREATE POLICY "Service can manage RSS items" ON public.news_rss_items FOR ALL USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_news_countries_updated_at
  BEFORE UPDATE ON public.news_countries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_rss_feeds_updated_at
  BEFORE UPDATE ON public.news_rss_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default countries
INSERT INTO public.news_countries (code, name, name_en, name_pl, flag, sort_order) VALUES
  ('UA', 'Україна', 'Ukraine', 'Ukraina', '🇺🇦', 1),
  ('US', 'США', 'USA', 'USA', '🇺🇸', 2),
  ('PL', 'Польща', 'Poland', 'Polska', '🇵🇱', 3),
  ('IN', 'Індія', 'India', 'Indie', '🇮🇳', 4);