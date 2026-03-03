-- Create bot_visits table for tracking search engine and AI bot visits
CREATE TABLE IF NOT EXISTS public.bot_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_type text NOT NULL, -- googlebot, bingbot, gptbot, claudebot, etc.
  bot_category text NOT NULL, -- search, ai, social, other
  path text NOT NULL,
  user_agent text,
  ip_country text,
  referer text,
  status_code integer DEFAULT 200,
  response_time_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bot_visits_created_at ON public.bot_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_visits_bot_type ON public.bot_visits(bot_type);
CREATE INDEX IF NOT EXISTS idx_bot_visits_bot_category ON public.bot_visits(bot_category);
CREATE INDEX IF NOT EXISTS idx_bot_visits_path ON public.bot_visits(path);

-- Enable RLS
ALTER TABLE public.bot_visits ENABLE ROW LEVEL SECURITY;

-- Allow service to manage bot visits
DROP POLICY IF EXISTS "Service can manage bot visits" ON public.bot_visits;
CREATE POLICY "Service can manage bot visits"
ON public.bot_visits
FOR ALL
USING (true);

-- Allow anyone to read bot visits (for admin panel)
DROP POLICY IF EXISTS "Anyone can read bot visits" ON public.bot_visits;
CREATE POLICY "Anyone can read bot visits"
ON public.bot_visits
FOR SELECT
USING (true);