
-- Recreate table WITH 'id' column to match Frontend expectations
DROP TABLE IF EXISTS news_wiki_entities;

CREATE TABLE news_wiki_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY, -- Frontend needs this ID
    news_item_id UUID NOT NULL REFERENCES news_rss_items(id) ON DELETE CASCADE,
    wiki_entity_id UUID NOT NULL REFERENCES wiki_entities(id) ON DELETE CASCADE,
    match_source TEXT,
    match_term TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(news_item_id, wiki_entity_id) -- Prevent duplicates
);

-- Re-enable RLS
ALTER TABLE news_wiki_entities ENABLE ROW LEVEL SECURITY;

-- Grant permissions explicitly
GRANT ALL ON news_wiki_entities TO postgres;
GRANT ALL ON news_wiki_entities TO service_role;
GRANT ALL ON news_wiki_entities TO authenticated;
GRANT SELECT ON news_wiki_entities TO anon;

-- Notify API to refresh
NOTIFY pgrst, 'reload config';
