-- Add new fields for second image, chat dialogues, and tweets
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS cover_image_url_2 TEXT,
ADD COLUMN IF NOT EXISTS cover_image_prompt_2 TEXT,
ADD COLUMN IF NOT EXISTS chat_dialogue JSONB,
ADD COLUMN IF NOT EXISTS tweets JSONB;

-- Track which news items have been used (to prevent duplicates)
ALTER TABLE public.news_items
ADD COLUMN IF NOT EXISTS used_for_part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL;

-- Create index for faster lookup of unused news
CREATE INDEX IF NOT EXISTS idx_news_items_unused ON public.news_items(fetched_at) WHERE used_for_part_id IS NULL;