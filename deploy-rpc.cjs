const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*?)"/);

const supabaseUrl = urlMatch ? urlMatch[1] : null;
const supabaseKey = keyMatch ? keyMatch[1] : null;

// The SQL to execute
const sql = `
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
                    SELECT id, title, title_en, description, description_en, content_en, image_url, published_at, slug, category
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
`;

// Try to execute via admin edge function (which we know exists and can execute arbitrary actions)
async function deploy() {
    try {
        // Assuming the admin edge function can execute raw SQL if we pass it, or we use the query endpoint directly if exposed
        // But since we can't easily execute raw DDL from REST without the service key (and we only have anon key in .env),
        // It's better to just instruct the user to run it in the SQL Editor.
        console.log("Cannot safely execute DDL (CREATE FUNCTION) via anonymous REST API.");
        console.log("Please run this in the Supabase Dashboard SQL Editor.");
    } catch (e) {
        console.error(e);
    }
}

deploy();
