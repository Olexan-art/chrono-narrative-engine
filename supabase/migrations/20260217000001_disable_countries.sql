-- Disable India and Poland
UPDATE news_countries 
SET is_active = false 
WHERE code IN ('IN', 'PL');

-- Disable RSS feeds for these countries
UPDATE news_rss_feeds 
SET is_active = false 
WHERE country_id IN (
    SELECT id FROM news_countries WHERE code IN ('IN', 'PL')
);