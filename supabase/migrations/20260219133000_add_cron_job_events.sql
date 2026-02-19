-- Add table to record cron job events (scheduled / unscheduled / runs / manual runs)
CREATE TABLE IF NOT EXISTS cron_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT,
  event_type TEXT NOT NULL, -- 'scheduled','unscheduled','run_started','run_finished','run_failed','manual_trigger','deleted'
  origin TEXT DEFAULT 'admin', -- 'admin'|'pg_cron'|'manual'|'system'
  status TEXT, -- optional run status: 'running'|'success'|'failed'|'warning'
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_events_job_time ON cron_job_events(job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_events_event_type ON cron_job_events(event_type);

-- Enable RLS and create a conservative policy similar to other cron tables
ALTER TABLE cron_job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can insert cron events" ON cron_job_events
  FOR INSERT USING (auth.jwt() ->> 'role' = 'authenticated');

CREATE POLICY "Admin can select cron events" ON cron_job_events
  FOR SELECT USING (auth.jwt() ->> 'role' = 'authenticated');
