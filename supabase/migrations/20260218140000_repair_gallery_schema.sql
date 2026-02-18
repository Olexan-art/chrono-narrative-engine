-- Repair migration for Outrage Ink gallery tables
-- This ensures that all required tables and foreign key relationships exist

-- 1. Ensure wiki_entities exists (base table for tags)
CREATE TABLE IF NOT EXISTS public.wiki_entities (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    wiki_id text NOT NULL UNIQUE,
    entity_type text NOT NULL DEFAULT 'unknown',
    name text NOT NULL,
    name_en text,
    description text,
    description_en text,
    image_url text,
    wiki_url text NOT NULL,
    wiki_url_en text,
    extract text,
    extract_en text,
    raw_data jsonb DEFAULT '{}'::jsonb,
    search_count integer NOT NULL DEFAULT 1,
    last_searched_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Ensure outrage_ink exists
CREATE TABLE IF NOT EXISTS public.outrage_ink (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_item_id UUID REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    title TEXT,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Ensure outrage_ink_entities exists and HAS THE RELATIONSHIP
-- This is likely the missing piece that causes the 400 Bad Request
CREATE TABLE IF NOT EXISTS public.outrage_ink_entities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outrage_ink_id UUID NOT NULL REFERENCES public.outrage_ink(id) ON DELETE CASCADE,
    wiki_entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(outrage_ink_id, wiki_entity_id)
);

-- 4. Ensure outrage_ink_votes exists
CREATE TABLE IF NOT EXISTS public.outrage_ink_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outrage_ink_id UUID NOT NULL REFERENCES public.outrage_ink(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    vote_type TEXT CHECK (vote_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(outrage_ink_id, visitor_id)
);

-- 5. Enable RLS and add permissive policies
ALTER TABLE public.outrage_ink ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outrage_ink_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outrage_ink_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_entities ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Anyone can view outrage ink" ON public.outrage_ink;
CREATE POLICY "Anyone can view outrage ink" ON public.outrage_ink FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view outrage ink entities" ON public.outrage_ink_entities;
CREATE POLICY "Anyone can view outrage ink entities" ON public.outrage_ink_entities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view wiki entities" ON public.wiki_entities;
CREATE POLICY "Anyone can view wiki entities" ON public.wiki_entities FOR SELECT USING (true);

-- Maintenance: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
