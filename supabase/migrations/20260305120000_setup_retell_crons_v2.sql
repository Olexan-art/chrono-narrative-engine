-- Setup pg_cron jobs for automatic Z.AI + DeepSeek retelling
-- Replaces old migrations that used wrong project URL (ntohvowbhmrwyhdwuvus)

-- 1. Remove existing cron jobs if they exist (idempotent cleanup)
DO $$
BEGIN
  PERFORM cron.unschedule('invoke_bulk_retell_news_zai_15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('invoke_bulk_retell_news_deepseek_15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Schedule Z.AI retell — every 15 min at :00, :15, :30, :45
SELECT cron.schedule(
  'invoke_bulk_retell_news_zai_15m',
  '*/15 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-zai',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_1h","llm_model":"GLM-4.7-Flash","job_name":"bulk_retell_all_zai","trigger":"cron"}'::jsonb
    );
  $$
);

-- 3. Schedule DeepSeek retell — every 15 min, offset +7 min (:07, :22, :37, :52)
SELECT cron.schedule(
  'invoke_bulk_retell_news_deepseek_15m',
  '7-59/15 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-deepseek',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_1h","llm_model":"deepseek-chat","job_name":"bulk_retell_all_deepseek","trigger":"cron"}'::jsonb
    );
  $$
);

-- 4. Register jobs in cron_job_configs for dashboard tracking
INSERT INTO cron_job_configs (job_name, frequency_minutes, enabled)
VALUES
  ('bulk_retell_all_zai', 15, true),
  ('bulk_retell_all_deepseek', 15, true)
ON CONFLICT (job_name) DO UPDATE
  SET frequency_minutes = EXCLUDED.frequency_minutes,
      enabled = EXCLUDED.enabled;
