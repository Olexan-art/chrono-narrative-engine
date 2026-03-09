-- ============================================================================
-- Topics Cache Pre-warming Cron Job
-- ============================================================================
-- Purpose: Automatically refresh cached HTML for topics pages every 6 hours
-- This ensures users always get fresh static content without waiting for bots
--
-- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
-- Function: Calls cache-topics-cron Edge Function to pre-warm SSR cache
-- ============================================================================

SELECT cron.unschedule('cache-topics-prewarm');

SELECT cron.schedule(
  'cache-topics-prewarm',
  '0 */6 * * *', -- Every 6 hours
  $$
    SELECT
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/cache-topics-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) AS request_id;
  $$
);

-- Verify cron job created
SELECT 
  jobid, 
  jobname, 
  schedule, 
  active,
  command
FROM cron.job 
WHERE jobname = 'cache-topics-prewarm';

COMMENT ON EXTENSION cron IS 'Topics cache cron job: Refreshes /topics and top 30 topic pages every 6 hours to ensure fast static delivery for all users.';
