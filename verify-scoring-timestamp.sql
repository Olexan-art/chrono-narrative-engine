-- Verify source_scoring_at column was created
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'news_rss_items' 
    AND column_name = 'source_scoring_at';

-- Check index was created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'news_rss_items' 
    AND indexname = 'idx_news_rss_items_source_scoring_at';

-- Show recent scoring with timestamps
SELECT 
    title,
    source_scoring_at,
    llm_processed_at,
    published_at,
    (source_scoring->'json'->'scores'->>'overall')::int as score
FROM news_rss_items
WHERE source_scoring IS NOT NULL
ORDER BY source_scoring_at DESC NULLS LAST
LIMIT 10;
