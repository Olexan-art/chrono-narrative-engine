
-- Create wiki_entity_aliases table for alternative names
CREATE TABLE public.wiki_entity_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_wiki_entity_aliases_alias ON public.wiki_entity_aliases (lower(alias));
CREATE INDEX idx_wiki_entity_aliases_entity_id ON public.wiki_entity_aliases (entity_id);

-- Unique constraint to prevent duplicate aliases
CREATE UNIQUE INDEX idx_wiki_entity_aliases_unique ON public.wiki_entity_aliases (entity_id, lower(alias));

-- Enable RLS
ALTER TABLE public.wiki_entity_aliases ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read wiki entity aliases"
  ON public.wiki_entity_aliases FOR SELECT USING (true);

-- Service can manage
CREATE POLICY "Service can manage wiki entity aliases"
  ON public.wiki_entity_aliases FOR ALL USING (true) WITH CHECK (true);
