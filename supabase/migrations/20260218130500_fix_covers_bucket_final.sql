-- Robust script to ensure 'covers' bucket exists and is accessible

-- 1. Ensure the bucket exists
-- We use both id and name as 'covers'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Clear old policies to ensure a clean state
DROP POLICY IF EXISTS "Public can read covers" ON storage.objects;
DROP POLICY IF EXISTS "Service can manage covers" ON storage.objects;
DROP POLICY IF EXISTS "Anon can manage covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can manage covers" ON storage.objects;
DROP POLICY IF EXISTS "Covers full access" ON storage.objects;

-- 3. Create a truly global policy for the 'covers' bucket
-- This is necessary because the admin panel uses the 'anon' key (not Supabase Auth)
CREATE POLICY "Anyone can manage covers"
ON storage.objects FOR ALL
USING (bucket_id = 'covers')
WITH CHECK (bucket_id = 'covers');

-- 4. Enable RLS on storage.objects (it should be on, but just in case)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Final verification query (this will show in the "Results" tab)
SELECT id, name, public FROM storage.buckets WHERE id = 'covers';
