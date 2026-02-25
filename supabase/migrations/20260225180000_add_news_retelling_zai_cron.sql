-- Додаємо новий cron для Z.AI ретелінгу новин
INSERT INTO cron_job_configs (job_name, frequency_minutes, countries, processing_options, enabled)
VALUES
  ('news_retelling_zai', 90, ARRAY['us', 'ua', 'pl'], '{"tags": true, "entities": true, "retelling": true, "key_points": true}'::jsonb, true)
ON CONFLICT (job_name) DO NOTHING;
