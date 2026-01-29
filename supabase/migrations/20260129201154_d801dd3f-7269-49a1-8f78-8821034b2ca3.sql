-- Create wiki_entities table for storing Wikipedia cards
CREATE TABLE public.wiki_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wiki_id text NOT NULL UNIQUE,
  entity_type text NOT NULL DEFAULT 'unknown', -- 'person', 'company', 'organization', 'other'
  name text NOT NULL,
  name_en text,
  description text,
  description_en text,
  image_url text,
  wiki_url text NOT NULL,
  wiki_url_en text,
  extract text, -- Short summary from Wikipedia
  extract_en text,
  raw_data jsonb DEFAULT '{}'::jsonb, -- Store full API response for future use
  search_count integer NOT NULL DEFAULT 1, -- How many times this entity was found
  last_searched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create junction table for news-entity relationships
CREATE TABLE public.news_wiki_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_item_id uuid NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  wiki_entity_id uuid NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  match_source text NOT NULL DEFAULT 'keyword', -- 'title', 'keyword', 'manual'
  match_term text, -- The actual keyword/phrase that matched
  relevance_score integer DEFAULT 50, -- 0-100, how relevant is this entity
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(news_item_id, wiki_entity_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_wiki_entities ENABLE ROW LEVEL SECURITY;

-- RLS policies for wiki_entities
CREATE POLICY "Anyone can read wiki entities" 
ON public.wiki_entities 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage wiki entities" 
ON public.wiki_entities 
FOR ALL 
USING (true);

-- RLS policies for news_wiki_entities
CREATE POLICY "Anyone can read news wiki entities" 
ON public.news_wiki_entities 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage news wiki entities" 
ON public.news_wiki_entities 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_wiki_entities_wiki_id ON public.wiki_entities(wiki_id);
CREATE INDEX idx_wiki_entities_name ON public.wiki_entities(name);
CREATE INDEX idx_wiki_entities_type ON public.wiki_entities(entity_type);
CREATE INDEX idx_news_wiki_entities_news ON public.news_wiki_entities(news_item_id);
CREATE INDEX idx_news_wiki_entities_entity ON public.news_wiki_entities(wiki_entity_id);

-- Trigger for updated_at
CREATE TRIGGER update_wiki_entities_updated_at
BEFORE UPDATE ON public.wiki_entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();