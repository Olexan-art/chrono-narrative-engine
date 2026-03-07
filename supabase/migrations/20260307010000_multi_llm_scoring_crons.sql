-- Add multiple LLM provider crons for source scoring
-- Z.AI: every 30 minutes (00 and 30)
-- Gemini: every hour at :15
-- OpenAI: every 3 hours at :00 (0, 3, 6, 9, 12, 15, 18, 21)
-- DeepSeek: already exists (every hour at :30) in 20260307000000_source_scoring_hourly_cron.sql

-- Unschedule if exists
DO $$
BEGIN
  PERFORM cron.unschedule('invoke_source_scoring_zai_30min');
  PERFORM cron.unschedule('invoke_source_scoring_gemini_hourly');
  PERFORM cron.unschedule('invoke_source_scoring_openai_3h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Z.AI every 30 minutes (at 00 and 30 minutes)
SELECT cron.schedule(
  'invoke_source_scoring_zai_30min',
  '0,30 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/score-news-source',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"auto_select":true,"model":"GLM-4.7-Flash","provider":"zai"}'::jsonb
    );
  $$
);

-- Gemini every hour at :15
SELECT cron.schedule(
  'invoke_source_scoring_gemini_hourly',
  '15 * * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/score-news-source',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"auto_select":true,"model":"gemini-2.5-flash","provider":"gemini"}'::jsonb
    );
  $$
);

-- OpenAI every 3 hours at :00 (0, 3, 6, 9, 12, 15, 18, 21)
SELECT cron.schedule(
  'invoke_source_scoring_openai_3h',
  '0 */3 * * *',
  $$
    select net.http_post(
      url:='https://tuledxqigzufkecztnlo.supabase.co/functions/v1/score-news-source',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4"}'::jsonb,
      body:='{"auto_select":true,"model":"gpt-4o-mini","provider":"openai"}'::jsonb
    );
  $$
);
