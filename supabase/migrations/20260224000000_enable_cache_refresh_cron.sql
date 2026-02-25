-- Enable cache refresh cron job (was disabled by default).
-- Runs every 60 minutes using the 'recent-24h' filter to warm
-- only recently-published news so Google Bot never gets a cold MISS.
UPDATE cron_job_configs
SET
  enabled          = true,
  frequency_minutes = 60
WHERE job_name = 'cache_refresh';
