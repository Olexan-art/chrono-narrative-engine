-- Create cron_logs table
CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'running', 'success', 'error'
    message TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- Add RLS policies for cron_logs
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cron_logs"
    ON public.cron_logs FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

CREATE POLICY "Allow service_role full access to cron_logs"
    ON public.cron_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add rss_check_schedule to settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'rss_check_schedule') THEN
        ALTER TABLE public.settings ADD COLUMN rss_check_schedule TEXT DEFAULT '1hour';
    END IF;
END $$;

-- Create exec_sql function for admin operations (manage-cron needs this)
-- SECURITY DEFINER allows it to run with elevated privileges
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format('SELECT json_agg(t) FROM (%s) t', sql) INTO result;
  RETURN result;
END;
$$;
