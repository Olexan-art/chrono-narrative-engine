-- RPC: get_retell_hourly_stats
-- Returns hourly Z.AI + DeepSeek retell counts for the last N hours
-- Replaces 48 separate Supabase queries in getRetellQueueStats (2 per hour × 24h)

CREATE OR REPLACE FUNCTION get_retell_hourly_stats(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
  slot_start TIMESTAMPTZ,
  zai_count   BIGINT,
  deepseek_count BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    date_trunc('hour', llm_processed_at) AS slot_start,
    COUNT(*) FILTER (WHERE llm_provider = 'zai')                                  AS zai_count,
    COUNT(*) FILTER (WHERE llm_provider IN ('deepseek', 'deepseek-fallback'))     AS deepseek_count
  FROM news_rss_items
  WHERE
    llm_processed_at IS NOT NULL
    AND llm_processed_at >= NOW() - (p_hours || ' hours')::interval
  GROUP BY 1
  ORDER BY 1;
$$;
