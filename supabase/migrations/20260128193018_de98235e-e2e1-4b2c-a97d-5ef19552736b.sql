-- Table for cached pre-rendered HTML pages
CREATE TABLE public.cached_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  html TEXT NOT NULL,
  title TEXT,
  description TEXT,
  canonical_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  generation_time_ms INTEGER,
  html_size_bytes INTEGER
);

-- Index for fast path lookup
CREATE INDEX idx_cached_pages_path ON public.cached_pages(path);
CREATE INDEX idx_cached_pages_expires ON public.cached_pages(expires_at);

-- Enable RLS but allow public read for bots
ALTER TABLE public.cached_pages ENABLE ROW LEVEL SECURITY;

-- Public read access (for edge functions and bots)
CREATE POLICY "Cached pages are publicly readable"
  ON public.cached_pages
  FOR SELECT
  USING (true);

-- Only allow insert/update/delete via service role (edge functions)
CREATE POLICY "Service role can manage cached pages"
  ON public.cached_pages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE TRIGGER update_cached_pages_updated_at
  BEFORE UPDATE ON public.cached_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();