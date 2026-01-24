-- Add cover_image_type column to parts table
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS cover_image_type TEXT DEFAULT 'generated';

-- Add comment for documentation
COMMENT ON COLUMN public.parts.cover_image_type IS 'Type of cover image to display: generated (AI) or news';