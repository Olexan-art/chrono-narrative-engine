-- Add url column to cached_pages to match production schema
-- Production has url TEXT NOT NULL UNIQUE as the conflict target for upserts

DO $$
BEGIN
  -- Add url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cached_pages' AND column_name = 'url'
  ) THEN
    ALTER TABLE public.cached_pages ADD COLUMN IF NOT EXISTS url TEXT;
    -- Fill existing rows with the full URL derived from path
    UPDATE public.cached_pages SET url = 'https://bravennow.com' || path WHERE url IS NULL;
    -- Add NOT NULL constraint after filling
    ALTER TABLE public.cached_pages ALTER COLUMN url SET NOT NULL;
    -- Add unique constraint on url
    ALTER TABLE public.cached_pages ADD CONSTRAINT cached_pages_url_key UNIQUE (url);
  END IF;
END $$;
