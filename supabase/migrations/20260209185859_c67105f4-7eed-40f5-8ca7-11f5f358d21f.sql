
-- Table to track merged/grouped news articles
CREATE TABLE public.news_merged_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT,
  slug TEXT,
  merged_count INTEGER NOT NULL DEFAULT 2,
  source_feeds JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name, logo_url, country_code}]
  primary_news_id UUID NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table: which news items belong to which merged group
CREATE TABLE public.news_merged_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.news_merged_groups(id) ON DELETE CASCADE,
  news_item_id UUID NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  similarity_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, news_item_id)
);

-- Enable RLS
ALTER TABLE public.news_merged_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_merged_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read merged groups" ON public.news_merged_groups FOR SELECT USING (true);
CREATE POLICY "Service can manage merged groups" ON public.news_merged_groups FOR ALL USING (true);

CREATE POLICY "Anyone can read merged items" ON public.news_merged_items FOR SELECT USING (true);
CREATE POLICY "Service can manage merged items" ON public.news_merged_items FOR ALL USING (true);

-- Index for lookups
CREATE INDEX idx_news_merged_items_news ON public.news_merged_items(news_item_id);
CREATE INDEX idx_news_merged_items_group ON public.news_merged_items(group_id);
CREATE INDEX idx_news_merged_groups_primary ON public.news_merged_groups(primary_news_id);

-- Trigger for updated_at
CREATE TRIGGER update_news_merged_groups_updated_at
  BEFORE UPDATE ON public.news_merged_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
