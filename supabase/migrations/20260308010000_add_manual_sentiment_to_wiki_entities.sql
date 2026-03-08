-- Add manual_sentiment to wiki_entities table
-- This allows admins to set overall sentiment/narrative for an entity

ALTER TABLE public.wiki_entities 
ADD COLUMN IF NOT EXISTS manual_sentiment text 
CHECK (manual_sentiment IN ('positive', 'negative', 'neutral', 'mixed'));

CREATE INDEX IF NOT EXISTS idx_wiki_entities_manual_sentiment 
ON public.wiki_entities(manual_sentiment);

COMMENT ON COLUMN public.wiki_entities.manual_sentiment 
IS 'Manually set sentiment/narrative by admin for the entity: positive, negative, neutral, or mixed';
