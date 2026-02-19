-- Create table for storing Ollama-generated retells (development staging)
-- This table is used by admin UI to save dev-only retells generated with local Ollama

CREATE TABLE IF NOT EXISTS public.ollama_retell_staging (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id uuid NOT NULL REFERENCES public.news_rss_items(id) ON DELETE CASCADE,
  model text NOT NULL,
  language text NOT NULL,
  content text NOT NULL,
  key_points jsonb,
  themes jsonb,
  keywords jsonb,
  created_at timestamptz DEFAULT now(),
  pushed boolean DEFAULT false,
  pushed_at timestamptz
);

-- Prevent duplicate staging rows for same news + model
CREATE UNIQUE INDEX IF NOT EXISTS ux_ollama_retell_staging_news_model ON public.ollama_retell_staging(news_id, model);

-- RLS: allow all (dev-only table used from anon/authenticated client)
ALTER TABLE public.ollama_retell_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ollama_staging_allow_all" ON public.ollama_retell_staging
  FOR ALL USING (true) WITH CHECK (true);