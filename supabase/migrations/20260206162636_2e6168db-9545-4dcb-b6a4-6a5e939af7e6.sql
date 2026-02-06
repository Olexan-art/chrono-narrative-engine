-- Add likes/dislikes columns to news_rss_items
ALTER TABLE public.news_rss_items 
ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_simulation_started_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS viral_simulation_completed boolean DEFAULT false;

-- Create news_votes table for tracking individual votes
CREATE TABLE IF NOT EXISTS public.news_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_item_id uuid NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(news_item_id, visitor_id)
);

-- Enable RLS
ALTER TABLE public.news_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for news_votes
CREATE POLICY "Anyone can vote on news" ON public.news_votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can only see their own votes" ON public.news_votes
  FOR SELECT USING (
    visitor_id = ((current_setting('request.headers'::text, true))::json ->> 'x-visitor-id')
    OR visitor_id IS NULL
  );

CREATE POLICY "Users can update their own votes" ON public.news_votes
  FOR UPDATE USING (true);

-- Create view for aggregated vote counts (SECURITY DEFINER to hide individual votes)
CREATE OR REPLACE VIEW public.news_vote_counts AS
SELECT 
  news_item_id,
  COUNT(*) FILTER (WHERE vote_type = 'like') as likes,
  COUNT(*) FILTER (WHERE vote_type = 'dislike') as dislikes
FROM public.news_votes
GROUP BY news_item_id;

-- Add viral simulation settings to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS viral_simulation_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS viral_news_per_day integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS viral_delay_hours numeric DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS viral_growth_hours numeric DEFAULT 24,
ADD COLUMN IF NOT EXISTS viral_decay_hours numeric DEFAULT 48,
ADD COLUMN IF NOT EXISTS viral_min_interactions integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS viral_max_interactions integer DEFAULT 300,
ADD COLUMN IF NOT EXISTS viral_dislike_ratio numeric DEFAULT 0.15,
ADD COLUMN IF NOT EXISTS viral_last_run_at timestamp with time zone DEFAULT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_news_votes_news_item_id ON public.news_votes(news_item_id);
CREATE INDEX IF NOT EXISTS idx_news_rss_items_viral ON public.news_rss_items(viral_simulation_started_at) WHERE viral_simulation_started_at IS NOT NULL;