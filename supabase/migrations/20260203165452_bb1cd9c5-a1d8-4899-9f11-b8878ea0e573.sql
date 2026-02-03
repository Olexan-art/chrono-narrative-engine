-- Create table for satirical caricatures
CREATE TABLE public.outrage_ink (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_item_id UUID REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_prompt TEXT,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  last_random_update TIMESTAMP WITH TIME ZONE
);

-- Create table for user votes
CREATE TABLE public.outrage_ink_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outrage_ink_id UUID NOT NULL REFERENCES public.outrage_ink(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(outrage_ink_id, visitor_id)
);

-- Create junction table for wiki entities
CREATE TABLE public.outrage_ink_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outrage_ink_id UUID NOT NULL REFERENCES public.outrage_ink(id) ON DELETE CASCADE,
  wiki_entity_id UUID NOT NULL REFERENCES public.wiki_entities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(outrage_ink_id, wiki_entity_id)
);

-- Enable RLS
ALTER TABLE public.outrage_ink ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outrage_ink_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outrage_ink_entities ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can view outrage ink" ON public.outrage_ink FOR SELECT USING (true);
CREATE POLICY "Anyone can view outrage ink votes" ON public.outrage_ink_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can view outrage ink entities" ON public.outrage_ink_entities FOR SELECT USING (true);

-- Public insert for votes (anyone can vote)
CREATE POLICY "Anyone can vote" ON public.outrage_ink_votes FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_outrage_ink_news_item ON public.outrage_ink(news_item_id);
CREATE INDEX idx_outrage_ink_created_at ON public.outrage_ink(created_at DESC);
CREATE INDEX idx_outrage_ink_likes ON public.outrage_ink(likes DESC);
CREATE INDEX idx_outrage_ink_votes_ink_id ON public.outrage_ink_votes(outrage_ink_id);
CREATE INDEX idx_outrage_ink_entities_ink_id ON public.outrage_ink_entities(outrage_ink_id);
CREATE INDEX idx_outrage_ink_entities_entity_id ON public.outrage_ink_entities(wiki_entity_id);

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('outrage-ink', 'outrage-ink', true);

-- Storage policies
CREATE POLICY "Anyone can view outrage ink images" ON storage.objects FOR SELECT USING (bucket_id = 'outrage-ink');
CREATE POLICY "Authenticated users can upload outrage ink images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'outrage-ink');
CREATE POLICY "Authenticated users can update outrage ink images" ON storage.objects FOR UPDATE USING (bucket_id = 'outrage-ink');
CREATE POLICY "Authenticated users can delete outrage ink images" ON storage.objects FOR DELETE USING (bucket_id = 'outrage-ink');