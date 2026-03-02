-- Function to efficiently fetch latest news grouped by active countries
-- Solves the N+1 query problem on the Index homepage
CREATE OR REPLACE FUNCTION get_latest_news_by_country(news_limit INT DEFAULT 6)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(country_data)
    INTO result
    FROM (
        SELECT 
            c.id, c.code, c.name, c.name_en, c.flag,
            (
                SELECT COALESCE(json_agg(news_item), '[]'::json)
                FROM (
                    SELECT id, title, title_en, description, description_en, content_en, image_url, published_at, slug, category, source_scoring
                    FROM news_rss_items n
                    WHERE n.country_id = c.id
                      AND n.slug IS NOT NULL
                    ORDER BY n.published_at DESC
                    LIMIT news_limit
                ) news_item
            ) as news
        FROM news_countries c
        WHERE c.is_active = true
        ORDER BY c.sort_order ASC
    ) country_data;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;
