-- Add category column to parts table
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'story';

-- Add manual_images column for storing up to 4 uploaded image URLs
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS manual_images JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for manual images
INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-images', 'manual-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for manual images bucket
CREATE POLICY "Manual images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'manual-images');

CREATE POLICY "Authenticated users can upload manual images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'manual-images');

CREATE POLICY "Authenticated users can update manual images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'manual-images');

CREATE POLICY "Authenticated users can delete manual images"
ON storage.objects FOR DELETE
USING (bucket_id = 'manual-images');

-- Add comment for documentation
COMMENT ON COLUMN public.parts.category IS 'Category of the part: story (default), just_business';
COMMENT ON COLUMN public.parts.manual_images IS 'Array of manually uploaded image URLs (max 4)';