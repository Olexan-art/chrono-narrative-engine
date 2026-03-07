-- Change retell cron jobs from 15 minutes to 10 minutes
-- ZAI: :00 :10 :20 :30 :40 :50
-- DeepSeek: :05 :15 :25 :35 :45 :55  (offset +5 to spread load)

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

DO $$
BEGIN
  PERFORM cron.unschedule('invoke_bulk_retell_news_zai_10m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('invoke_bulk_retell_news_deepseek_10m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Z.AI every 10 min: :00, :10, :20, :30, :40, :50
SELECT cron.schedule(
  'invoke_bulk_retell_news_zai_10m',
  '*/10 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-zai',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_1h","llm_model":"GLM-4.7-Flash","job_name":"bulk_retell_all_zai","trigger":"cron"}'::jsonb
    );
  $$
);

-- DeepSeek every 10 min, offset +5: :05, :15, :25, :35, :45, :55
SELECT cron.schedule(
  'invoke_bulk_retell_news_deepseek_10m',
  '5-59/10 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-deepseek',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_1h","llm_model":"deepseek-chat","job_name":"bulk_retell_all_deepseek","trigger":"cron"}'::jsonb
    );
  $$
);

-- Update cron_job_configs to reflect 10 min frequency
INSERT INTO cron_job_configs (job_name, frequency_minutes, enabled)
VALUES
  ('bulk_retell_all_zai', 10, true),
  ('bulk_retell_all_deepseek', 10, true)
ON CONFLICT (job_name) DO UPDATE
  SET frequency_minutes = EXCLUDED.frequency_minutes,
      enabled = EXCLUDED.enabled;
