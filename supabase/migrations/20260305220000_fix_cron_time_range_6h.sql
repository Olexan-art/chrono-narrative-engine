-- Fix: expand time_range from last_1h to last_6h so ZAI doesn't arrive on empty queue
-- after DeepSeek just cleared it

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

-- Z.AI every 10 min, time_range last_6h
SELECT cron.schedule(
  'invoke_bulk_retell_news_zai_10m',
  '*/10 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-zai',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_6h","llm_model":"GLM-4.7-Flash","job_name":"bulk_retell_all_zai","trigger":"cron"}'::jsonb
    );
  $$
);

-- DeepSeek every 10 min offset +5, time_range last_6h
SELECT cron.schedule(
  'invoke_bulk_retell_news_deepseek_10m',
  '5-59/10 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-deepseek',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"country_code":"ALL","time_range":"last_6h","llm_model":"deepseek-chat","job_name":"bulk_retell_all_deepseek","trigger":"cron"}'::jsonb
    );
  $$
);
