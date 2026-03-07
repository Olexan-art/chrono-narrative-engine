-- Перевірка крон джобів для score-news-source
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%score-news-source%' OR jobname LIKE '%scoring%'
ORDER BY jobname;

-- Також перевірити всі крон джоби
SELECT 
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;
