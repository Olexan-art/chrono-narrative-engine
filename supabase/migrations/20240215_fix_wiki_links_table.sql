
-- Inspect and Fix news_wiki_entities

-- 1. Ensure it has a Primary Key (Composite)
-- This is critical for PostgREST to work correctly with this table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_wiki_entities_pkey') THEN
        ALTER TABLE news_wiki_entities
        ADD CONSTRAINT news_wiki_entities_pkey PRIMARY KEY (news_item_id, wiki_entity_id);
    END IF;
END
$$;

-- 2. Ensure RLS is enabled (should be, but good to check)
ALTER TABLE news_wiki_entities ENABLE ROW LEVEL SECURITY;

-- 3. Grant Permissions explicitely
GRANT ALL ON news_wiki_entities TO postgres;
GRANT ALL ON news_wiki_entities TO service_role;
GRANT ALL ON news_wiki_entities TO authenticated;
GRANT SELECT ON news_wiki_entities TO anon;

-- 4. Reload Schema Cache again just to be sure
NOTIFY pgrst, 'reload config';
