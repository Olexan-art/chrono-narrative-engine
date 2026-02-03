-- Add column for storing original RSS content (before AI retelling)
ALTER TABLE public.news_rss_items 
ADD COLUMN IF NOT EXISTS original_content TEXT;

-- Copy existing RSS content (from description/content) to original_content where AI retelling exists
UPDATE public.news_rss_items
SET original_content = COALESCE(description, '')
WHERE original_content IS NULL
  AND (content_en IS NOT NULL AND LENGTH(content_en) > 300);

-- Add comment for clarity
COMMENT ON COLUMN public.news_rss_items.original_content IS 'Original RSS feed content before AI retelling';