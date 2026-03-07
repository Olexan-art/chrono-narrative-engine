-- Create hourly cron for source scoring with DeepSeek
-- Runs every hour at :30 minutes (30 minutes after the hour)

DO $$
BEGIN
  PERFORM cron.unschedule('invoke_source_scoring_hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Source Scoring hourly: every hour at :30
SELECT cron.schedule(
  'invoke_source_scoring_hourly',
  '30 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/score-news-source',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"auto_select":true,"model":"deepseek-chat","provider":"deepseek"}'::jsonb
    );
  $$
);
