
-- Table to store narrative analysis results per entity/month
CREATE TABLE public.narrative_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'uk',
  news_count INTEGER NOT NULL DEFAULT 0,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_entities JSONB DEFAULT '[]'::jsonb,
  is_regenerated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_id, year_month, language)
);

-- Enable RLS
ALTER TABLE public.narrative_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read narrative analyses"
ON public.narrative_analyses FOR SELECT USING (true);

CREATE POLICY "Service can manage narrative analyses"
ON public.narrative_analyses FOR ALL USING (true);

-- Index for fast lookups
CREATE INDEX idx_narrative_analyses_entity ON public.narrative_analyses(entity_id, year_month);
