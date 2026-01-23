-- Create storage bucket for cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can read covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

-- Allow service role to manage covers
CREATE POLICY "Service can manage covers"
ON storage.objects FOR ALL
USING (bucket_id = 'covers');