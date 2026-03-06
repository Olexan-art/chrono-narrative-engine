-- Add pg_cron job for automatic analysis backfill
-- Runs every 5 minutes, processes up to 5 unanalyzed items from last 6h
-- Uses DeepSeek (deepseek-chat) for reliability

DO $$
BEGIN
  PERFORM cron.unschedule('bulk_generate_analysis_5m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bulk_generate_analysis_5m',
  '2-57/5 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-generate-analysis',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"limit":5,"hours_back":6,"model":"deepseek-chat"}'::jsonb
    );
  $$
);
