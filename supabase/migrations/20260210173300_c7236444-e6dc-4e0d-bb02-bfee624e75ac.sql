
-- Create wiki_entity_links table for entity-to-entity relationships (e.g., from Wikipedia links or admin manual linking)
CREATE TABLE public.wiki_entity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'wiki_link',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_entity_id, target_entity_id)
);

-- Enable RLS
ALTER TABLE public.wiki_entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wiki entity links"
ON public.wiki_entity_links FOR SELECT USING (true);

CREATE POLICY "Service can manage wiki entity links"
ON public.wiki_entity_links FOR ALL USING (true);

-- Index for quick lookups
CREATE INDEX idx_wiki_entity_links_source ON public.wiki_entity_links(source_entity_id);
CREATE INDEX idx_wiki_entity_links_target ON public.wiki_entity_links(target_entity_id);
