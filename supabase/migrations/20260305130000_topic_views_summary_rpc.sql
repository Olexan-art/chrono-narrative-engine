-- Optimization: add GIN index on themes (array column used in @> queries)
-- Without this, every theme query does a full table scan
CREATE INDEX IF NOT EXISTS idx_news_rss_items_themes_gin
  ON public.news_rss_items USING gin(themes);

-- RPC: get_topic_views_summary(p_topic)
-- Returns total_count + aggregated daily views for news AND wiki entities
-- in a single DB call, replacing 3 separate client queries:
--   1. COUNT(*) WHERE themes @> [topic]
--   2. daily_views for news_ids (limited to 80 items)
--   3. daily_views for entity_ids (requires prior entity query to resolve)
CREATE OR REPLACE FUNCTION get_topic_views_summary(p_topic TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total   BIGINT;
  v_news_dv JSONB;
  v_ent_dv  JSONB;
BEGIN
  -- 1. Total news count for this topic (no LIMIT)
  SELECT COUNT(*) INTO v_total
  FROM news_rss_items
  WHERE themes @> ARRAY[p_topic];

  -- 2. Sum of daily pageviews across ALL news articles in topic, grouped by date
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('date', d, 'views', v) ORDER BY d),
    '[]'::jsonb
  ) INTO v_news_dv
  FROM (
    SELECT dv.view_date::text AS d, SUM(dv.views)::int AS v
    FROM daily_views dv
    JOIN news_rss_items n ON n.id = dv.entity_id
    WHERE n.themes @> ARRAY[p_topic]
      AND dv.entity_type = 'news'
    GROUP BY dv.view_date
  ) _t;

  -- 3. Sum of daily pageviews across ALL wiki entities linked to topic news, grouped by date
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('date', d, 'views', v) ORDER BY d),
    '[]'::jsonb
  ) INTO v_ent_dv
  FROM (
    SELECT dv.view_date::text AS d, SUM(dv.views)::int AS v
    FROM daily_views dv
    JOIN news_wiki_entities nwe ON nwe.wiki_entity_id = dv.entity_id
    JOIN news_rss_items n ON n.id = nwe.news_item_id
    WHERE n.themes @> ARRAY[p_topic]
      AND dv.entity_type = 'wiki'
    GROUP BY dv.view_date
  ) _t;

  RETURN jsonb_build_object(
    'total_count',        v_total,
    'news_daily_views',   v_news_dv,
    'entity_daily_views', v_ent_dv
  );
END;
$$;

-- Grant execute to anon + authenticated roles (for client-side RPC)
GRANT EXECUTE ON FUNCTION get_topic_views_summary(TEXT) TO anon, authenticated;
