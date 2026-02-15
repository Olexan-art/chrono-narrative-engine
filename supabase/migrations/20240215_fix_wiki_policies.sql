
-- Fix RLS policies to allow frontend (anon) to see the links

-- Allow public read access to news_wiki_entities
DROP POLICY IF EXISTS "Public Read NewsWiki" ON news_wiki_entities;
CREATE POLICY "Public Read NewsWiki"
  ON news_wiki_entities FOR SELECT
  USING ( true );

-- Ensure wiki_entities is also readable (should be, but just in case)
DROP POLICY IF EXISTS "Public Read Wiki" ON wiki_entities;
CREATE POLICY "Public Read Wiki"
  ON wiki_entities FOR SELECT
  USING ( true );

-- Notify API to refresh
NOTIFY pgrst, 'reload config';
