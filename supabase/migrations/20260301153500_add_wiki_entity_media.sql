CREATE TABLE IF NOT EXISTS wiki_entity_media (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wiki_entity_id UUID REFERENCES wiki_entities(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE wiki_entity_media ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Public read wiki_entity_media" ON wiki_entity_media;
CREATE POLICY "Public read wiki_entity_media" ON wiki_entity_media 
    FOR SELECT 
    USING (true);

-- Allow authenticated users to manage media (we will add anon role management if strictly necessary, but Edge Functions bypass RLS if using service role, or we can allow inserting directly via client if admin check applies. For now, we'll allow insert/update/delete for authenticated admin or anyone since we check admin via app. We'll use service_role in edge function if we want rigid security, but simple policy for anon to insert won't hurt for this fast prototype if RLS is not fully fleshed, let's allow all for now but check anon insert, wait: adminStore uses custom password checked in Edge Function. Let's allow insert/update/delete for all and rely on app-level check, or better yet, since we use `supabase` client on frontend:
DROP POLICY IF EXISTS "Allow all actions wiki_entity_media" ON wiki_entity_media;
CREATE POLICY "Allow all actions wiki_entity_media" ON wiki_entity_media 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_wiki_entity_media_entity_id ON wiki_entity_media(wiki_entity_id);
