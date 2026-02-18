-- Simplified script to ensure 'covers' bucket exists and is accessible

-- 1. Ensure the bucket exists (id and name both 'covers')
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Create policies (using DO block to ignore errors if they exist, but skip DROP to avoid ownership issues)
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

    -- Anon/Public management access (Full access for testing)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Anyone can manage covers'
    ) THEN
        CREATE POLICY "Anyone can manage covers"
        ON storage.objects FOR ALL
        USING (bucket_id = 'covers')
        WITH CHECK (bucket_id = 'covers');
    END IF;
END
$$;

-- 3. DIAGNOSTIC: Check what's actually in the buckets table
SELECT id, name, public, owner FROM storage.buckets;
