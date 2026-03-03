-- Створення cron job конфігурацій для автоматичного збору RSS новин
-- Виконати в Supabase SQL Editor

-- 1. Збір новин для США кожні 30 хвилин
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active, country_id) 
VALUES (
  gen_random_uuid(),
  'US RSS Collection',
  'Збір RSS новин для США',
  '*/30 * * * *', -- кожні 30 хвилин
  'fetch_country',
  '{"country_id": "1f57c11e-ab27-4e4e-b289-ca31dc80e895"}',
  true,
  '1f57c11e-ab27-4e4e-b289-ca31dc80e895'
);

-- 2. Збір новин для України кожні 45 хвилин
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active, country_id) 
VALUES (
  gen_random_uuid(),
  'UA RSS Collection', 
  'Збір RSS новин для України',
  '*/45 * * * *', -- кожні 45 хвилин
  'fetch_country',
  '{"country_id": "d5db2e45-9d9c-4593-a0ee-8ba6c1f44b11"}',
  true,
  'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11'
);

-- 3. Обробка pending новин кожні 15 хвилин
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Process Pending News',
  'Обробка накопичених новін для публікації',
  '*/15 * * * *', -- кожні 15 хвилин
  'process_pending',
  '{}',
  true
);

-- 4. Перевірка статистик кожну годину
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Cron Stats Check',
  'Перевірка статистик cron джобів',
  '0 * * * *', -- кожну годину
  'get_cron_stats', 
  '{}',
  true
);

-- Перевірити створені джоби
SELECT name, description, schedule_cron, action_type, is_active, created_at 
FROM cron_job_configs 
ORDER BY created_at DESC;