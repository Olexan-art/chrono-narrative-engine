-- Add is_flash_news column to parts table
ALTER TABLE public.parts 
ADD COLUMN is_flash_news boolean NOT NULL DEFAULT false;

-- Add index for filtering flash news
CREATE INDEX idx_parts_flash_news ON public.parts(is_flash_news) WHERE is_flash_news = true;