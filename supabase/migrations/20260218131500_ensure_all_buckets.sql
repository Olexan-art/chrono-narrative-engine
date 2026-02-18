-- Final script to ensure ALL required buckets exist and are accessible

-- 1. Ensure 'covers' bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Ensure 'outrage-ink' bucket exists (for caricatures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('outrage-ink', 'outrage-ink', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Create permissive policies for both buckets
DO $$
BEGIN
    -- Policies for 'covers'
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can manage covers') THEN
        CREATE POLICY "Anyone can manage covers" ON storage.objects FOR ALL USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');
    END IF;

    -- Policies for 'outrage-ink'
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can manage outrage-ink') THEN
        CREATE POLICY "Anyone can manage outrage-ink" ON storage.objects FOR ALL USING (bucket_id = 'outrage-ink') WITH CHECK (bucket_id = 'outrage-ink');
    END IF;

    -- Public read for all buckets (if not already there)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public read access') THEN
        CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (true);
    END IF;
END
$$;

-- 4. DIAGNOSTIC: List all buckets
SELECT id, name, public FROM storage.buckets;
