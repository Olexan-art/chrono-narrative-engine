-- РОЗШИРЕНІ CRON JOB КОНФІГУРАЦІЇ ДЛЯ RSS + RETELL + TRANSLATE
-- Виконати в Supabase SQL Editor після setup-cron-jobs.sql

-- =====================================
-- RSS ДЖОБИ (доповнення до існуючих)
-- =====================================

-- Британія (кожні 2 години)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active, country_id) 
VALUES (
  gen_random_uuid(),
  'UK RSS Collection',
  'Збір RSS новин для Великої Британії',
  '0 */2 * * *', -- кожні 2 години
  'fetch_country',
  '{"country_id": "816cd62f-df7a-451e-8356-879dffd97d16"}',
  true,
  '816cd62f-df7a-451e-8356-879dffd97d16'
);

-- Індія (ВІДКЛЮЧЕНО за запитом)
-- INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active, country_id) 
-- VALUES (
--   gen_random_uuid(),
--   'India RSS Collection',
--   'Збір RSS новин для Індії',
--   '15 */2 * * *', -- кожні 2 години, 15 хвилин після року
--   'fetch_country',
--   '{"country_id": "f07acf0c-d33c-464c-a208-a456205e012f"}',
--   false,
--   'f07acf0c-d33c-464c-a208-a456205e012f'
-- );

-- =====================================
-- RETELL (ПЕРЕКАЗ) ДЖОБИ
-- =====================================

-- Переказ новин США (через 5 хвилин після RSS збору)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'USA News Retell',
  'Автоматичний переказ новин США после RSS збору',
  '5 */1 * * *', -- кожну годину, 5 хвилин після RSS
  'retell_news',
  '{"country_filter": "usa", "batch_size": 10, "model": "gemini-2.5-flash", "force_retell": false}',
  true
);

-- Переказ новин України (через 10 хвилин після RSS збору)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Ukraine News Retell',
  'Автоматичний переказ новин України после RSS збору',
  '10 */1 * * *', -- кожну годину, 10 хвилин після RSS
  'retell_news',
  '{"country_filter": "ukraine", "batch_size": 8, "model": "gemini-2.5-flash", "force_retell": false}',
  true
);

-- Глобальний переказ (кожні 2 години)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Global News Retell',
  'Переказ популярних новин з усіх країн',
  '30 */2 * * *', -- кожні 2 години
  'retell_news',
  '{"global": true, "batch_size": 15, "model": "gemini-3-flash-preview", "priority_only": true}',
  true
);

-- Переказ британських новин 
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'UK News Retell',
  'Переказ новин Великої Британії',
  '20 */3 * * *', -- кожні 3 години
  'retell_news',
  '{"country_filter": "uk", "batch_size": 6, "model": "gemini-2.5-flash"}',
  true
);

-- =====================================
-- TRANSLATE (ПЕРЕКЛАД) ДЖОБИ  
-- =====================================

-- Переклад українських новин на англійську (ВІДКЛЮЧЕНО)
-- INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
-- VALUES (
--   gen_random_uuid(),
--   'Translate UA to EN',
--   'Переклад українських новин на англійську мову',
--   '20 */2 * * *', -- кожні 2 години, після retell
--   'translate_news',
--   '{"source_country": "ukraine", "target_language": "en", "batch_size": 5, "only_retold": true}',
--   false
-- );

-- Переклад американських новин на польську (ВІДКЛЮЧЕНО)
-- INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
-- VALUES (
--   gen_random_uuid(),
--   'Translate US to PL',
--   'Переклад американських новин на польську мову',
--   '25 */3 * * *', -- кожні 3 години
--   'translate_news',
--   '{"source_country": "usa", "target_language": "pl", "batch_size": 3, "popular_only": true}',
--   false
-- );

-- Переклад індійських новин на місцеві мови (ВІДКЛЮЧЕНО)
-- INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
-- VALUES (
--   gen_random_uuid(),
--   'Translate Indian Languages',
--   'Переклад індійських новин на хінді, таміл, телугу, бенгалі',
--   '40 */4 * * *', -- кожні 4 години
--   'translate_indian_news',
--   '{"target_languages": ["hi", "ta", "te", "bn"], "batch_size": 5, "priority_news": true}',
--   false
-- );

-- Термінові переклади (flash news)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Flash News Translation',
  'Швидкий переклад термінових новин',
  '*/20 * * * *', -- кожні 20 хвилин
  'translate_flash_news',
  '{"urgent_only": true, "target_language": "en", "batch_size": 2, "max_age_hours": 1}',
  true
);

-- =====================================
-- МОНІТОРИНГ ТА ОБСЛУГОВУВАННЯ
-- =====================================

-- Моніторинг використання LLM (двічі на день)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'LLM Usage Monitor',
  'Моніторинг витрат LLM провайдерів та статистики використання',
  '0 8,20 * * *', -- о 8:00 та 20:00 щодня
  'llm_monitor',
  '{"check_usage": true, "generate_report": true, "alert_threshold": 0.8}',
  true
);

-- Очистка кешу перекладених сторінок (щоночі)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Cache Cleanup Retold',
  'Очистка та оновлення кешу для сторінок з новими переказами',
  '0 2 * * *', -- щодня о 2:00  
  'cache_maintenance',
  '{"action": "cleanup_retold", "refresh_popular": true, "max_age_days": 7}',
  true
);

-- Перевірка якості переказів та перекладів (щотижня)
INSERT INTO cron_job_configs (id, name, description, schedule_cron, action_type, action_payload, is_active) 
VALUES (
  gen_random_uuid(),
  'Quality Check Retold',
  'Перевірка якості автоматичних переказів та перекладів',
  '0 6 * * 1', -- щопонеділка о 6:00
  'quality_check',
  '{"check_retold": true, "check_translations": true, "sample_size": 50, "report": true}',
  true
);

-- =====================================
-- НАЛАШТУВАННЯ ПРІОРИТЕТІВ 
-- =====================================

-- Оновити пріоритети існуючих джобів
UPDATE cron_job_configs 
SET priority = 'critical' 
WHERE action_type = 'process_pending';

UPDATE cron_job_configs 
SET priority = 'high' 
WHERE action_type IN ('fetch_country', 'retell_news') 
  AND (description ILIKE '%США%' OR description ILIKE '%України%');

UPDATE cron_job_configs 
SET priority = 'medium' 
WHERE action_type IN ('translate_news', 'translate_indian_news');

UPDATE cron_job_configs 
SET priority = 'low' 
WHERE action_type IN ('llm_monitor', 'cache_maintenance', 'quality_check');

-- =====================================
-- ДОДАТКОВІ КОЛОНКИ ДЛЯ ВІДСТЕЖЕННЯ
-- =====================================

-- Додати колонки для відстеження залежностей між джобами
ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS depends_on TEXT[];
ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS max_duration_minutes INTEGER DEFAULT 30;
ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 3;
ALTER TABLE cron_job_configs ADD COLUMN IF NOT EXISTS retry_delay_minutes INTEGER DEFAULT 5;

-- Встановити залежності для retell джобів (чекають на RSS)
UPDATE cron_job_configs 
SET depends_on = ARRAY['usa_rss_collection']
WHERE name = 'USA News Retell';

UPDATE cron_job_configs 
SET depends_on = ARRAY['ukraine_rss_collection'] 
WHERE name = 'Ukraine News Retell';

-- Встановити залежності для translate джобів (чекають на retell)
UPDATE cron_job_configs 
SET depends_on = ARRAY['ukraine_news_retell']
WHERE name = 'Translate UA to EN';

-- Встановити максимальну тривалість для різних типів джобів
UPDATE cron_job_configs SET max_duration_minutes = 15 WHERE action_type = 'process_pending';
UPDATE cron_job_configs SET max_duration_minutes = 30 WHERE action_type = 'fetch_country';
UPDATE cron_job_configs SET max_duration_minutes = 45 WHERE action_type = 'retell_news';
UPDATE cron_job_configs SET max_duration_minutes = 60 WHERE action_type LIKE 'translate%';
UPDATE cron_job_configs SET max_duration_minutes = 120 WHERE action_type IN ('llm_monitor', 'quality_check');

-- =====================================
-- ПЕРЕВІРКА СТВОРЕНИХ ДЖОБІВ
-- =====================================

-- Показати всі створені cron джоби з пріоритетами  
SELECT 
  name,
  description,
  schedule_cron,
  action_type,
  priority,
  is_active,
  depends_on,
  max_duration_minutes,
  created_at
FROM cron_job_configs 
ORDER BY 
  CASE priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
    ELSE 5 
  END,
  created_at DESC;

-- Статистика за типами джобів
SELECT 
  action_type,
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN is_active THEN 1 END) as active_jobs,
  STRING_AGG(DISTINCT priority, ', ') as priorities
FROM cron_job_configs 
GROUP BY action_type
ORDER BY total_jobs DESC;

-- Перевірити розклади (щоб уникнути конфліктів)
SELECT 
  schedule_cron,
  COUNT(*) as jobs_count,
  STRING_AGG(name, ', ') as job_names
FROM cron_job_configs 
WHERE is_active = true
GROUP BY schedule_cron
HAVING COUNT(*) > 1
ORDER BY jobs_count DESC;