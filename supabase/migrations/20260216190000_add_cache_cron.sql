-- Add cache_refresh job to cron_job_configs
INSERT INTO cron_job_configs (job_name, frequency_minutes, countries, processing_options, enabled)
VALUES
  ('cache_refresh', 360, ARRAY[]::text[], '{}'::jsonb, false)
ON CONFLICT (job_name) DO NOTHING;
