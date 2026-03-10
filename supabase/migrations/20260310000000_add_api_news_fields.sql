-- Add fields for API news sources with scheduled publishing

ALTER TABLE news_rss_items 
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'rss';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_rss_items_scheduled_publish 
  ON news_rss_items(scheduled_publish_at) 
  WHERE scheduled_publish_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_rss_items_source_type 
  ON news_rss_items(source_type);

-- Add comment
COMMENT ON COLUMN news_rss_items.scheduled_publish_at IS 'Scheduled publish time for distributed release over 24 hours';
COMMENT ON COLUMN news_rss_items.source_type IS 'Source type: rss, api_thenewsapi, api_gnews';
