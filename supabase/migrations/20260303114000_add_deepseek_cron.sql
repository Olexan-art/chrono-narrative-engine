-- Define Deepseek parallel cron job
-- Calls the edge function every 15 minutes

select cron.schedule(
  'invoke_bulk_retell_news_deepseek_15m',
  '*/15 * * * *',
  $$
    select net.http_post(
      url:='https://ntohvowbhmrwyhdwuvus.supabase.co/functions/v1/bulk-retell-news-deepseek',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body:=jsonb_build_object(
        'country_code', 'ALL',
        'time_range', 'last_1h',
        'llm_model', 'deepseek-chat',
        'job_name', 'bulk_retell_all_deepseek',
        'trigger', 'cron'
      )
    );
  $$
);

INSERT INTO cron_job_configs (job_name, frequency_minutes, enabled)
VALUES ('bulk_retell_all_deepseek', 15, true)
ON CONFLICT (job_name) DO UPDATE SET frequency_minutes = EXCLUDED.frequency_minutes, enabled = EXCLUDED.enabled;
