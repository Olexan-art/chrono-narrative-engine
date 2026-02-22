-- Create contact_submissions table
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  topic TEXT NOT NULL,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  language TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  status TEXT DEFAULT 'new',
  ai_analysis TEXT,
  ai_analyzed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public contact form)
DROP POLICY IF EXISTS "Anyone can insert contact submissions" ON public.contact_submissions;
CREATE POLICY "Anyone can insert contact submissions"
  ON public.contact_submissions
  FOR INSERT
  WITH CHECK (true);

-- Anyone can select
DROP POLICY IF EXISTS "Allow reading contact submissions" ON public.contact_submissions;
CREATE POLICY "Allow reading contact submissions"
  ON public.contact_submissions
  FOR SELECT
  USING (true);

-- Allow updates (for admin to set status / ai_analysis)
DROP POLICY IF EXISTS "Allow updating contact submissions" ON public.contact_submissions;
CREATE POLICY "Allow updating contact submissions"
  ON public.contact_submissions
  FOR UPDATE
  USING (true);
