-- Clear wiki cache to force regeneration with Information Card support
-- This allows search engines and LLMs to see the Information Card content

-- Delete all cached wiki pages
DELETE FROM cached_pages 
WHERE path LIKE '/wiki%';

-- Ensure path has UNIQUE constraint (should already exist, but adding if missing)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'cached_pages_path_key'
  ) THEN
    ALTER TABLE cached_pages ADD CONSTRAINT cached_pages_path_key UNIQUE (path);
  END IF;
END $$;
