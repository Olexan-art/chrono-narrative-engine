-- Ensure storage bucket for cover images exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Re-create policies for covers to ensure they are present
DO $$
BEGIN
    -- Public read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public can read covers'
    ) THEN
        CREATE POLICY "Public can read covers"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'covers');
    END IF;

    -- Service role management
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Service can manage covers'
    ) THEN
        CREATE POLICY "Service can manage covers"
        ON storage.objects FOR ALL
        USING (bucket_id = 'covers');
    END IF;
END
$$;
