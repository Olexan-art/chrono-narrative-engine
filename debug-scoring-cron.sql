-- Check if crons are running today
SELECT 
    jobname,
    schedule,
    last_run,
    next_run,
    active
FROM cron.job
WHERE jobname LIKE '%score%'
ORDER BY last_run DESC NULLS LAST;

-- Check scoring activity for today
SELECT 
    COUNT(*) as total_scored,
    COUNT(CASE WHEN DATE(source_scoring_at) = CURRENT_DATE THEN 1 END) as scored_today,
    MIN(source_scoring_at) as first_scoring,
    MAX(source_scoring_at) as last_scoring
FROM news_rss_items
WHERE source_scoring IS NOT NULL;

-- Show today's scorings with details
SELECT 
    title,
    source_scoring_at,
    llm_processed_at,
    (source_scoring->'json'->'scores'->>'overall')::int as score,
    CASE 
        WHEN (source_scoring->'json'->>'model') LIKE '%glm%' THEN 'Z.AI'
        WHEN (source_scoring->'json'->>'model') LIKE '%gemini%' THEN 'Gemini'
        WHEN (source_scoring->'json'->>'model') LIKE '%deepseek%' THEN 'DeepSeek'
        WHEN (source_scoring->'json'->>'model') LIKE '%gpt%' THEN 'OpenAI'
        ELSE 'Unknown'
    END as provider
FROM news_rss_items
WHERE source_scoring IS NOT NULL 
    AND DATE(source_scoring_at) = CURRENT_DATE
ORDER BY source_scoring_at DESC
LIMIT 20;

-- Check if there are news ready for scoring
SELECT 
    COUNT(*) as ready_for_scoring
FROM news_rss_items
WHERE content IS NOT NULL 
    AND news_analysis IS NOT NULL 
    AND source_scoring IS NULL
LIMIT 1;
