-- Add manual_sentiment field to news_wiki_entities for admin override
-- This allows admins to manually set sentiment/narrative instead of relying only on LLM analysis

ALTER TABLE public.news_wiki_entities 
ADD COLUMN IF NOT EXISTS manual_sentiment text CHECK (manual_sentiment IN ('positive', 'negative', 'neutral', 'mixed'));

-- Add index for filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_news_wiki_entities_sentiment ON public.news_wiki_entities(manual_sentiment);

-- Comments
COMMENT ON COLUMN public.news_wiki_entities.manual_sentiment IS 'Manually set sentiment/narrative by admin: positive, negative, neutral, or mixed';
