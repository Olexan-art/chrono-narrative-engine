-- Create function to auto-refresh news cache when analysis blocks are updated

CREATE OR REPLACE FUNCTION handle_news_analysis_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any analysis-related fields were updated
  IF (
    OLD.news_analysis IS DISTINCT FROM NEW.news_analysis OR
    OLD.key_points IS DISTINCT FROM NEW.key_points OR
    OLD.themes IS DISTINCT FROM NEW.themes OR
    OLD.keywords IS DISTINCT FROM NEW.keywords
  ) THEN
    
    -- Call edge function to refresh cache (async, non-blocking)
    PERFORM net.http_post(
      url := (current_setting('app.settings.supabase_url') || '/functions/v1/auto-cache-news-updates'),
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := json_build_object(
        'old_record', row_to_json(OLD),
        'record', row_to_json(NEW),
        'type', 'UPDATE',
        'table', 'news_rss_items'
      )::text::jsonb,
      timeout := 5000
    );
    
    -- Log the cache refresh attempt
    INSERT INTO llm_usage_logs (
      operation,
      success,
      metadata
    ) VALUES (
      'news-cache-refresh',
      true,
      json_build_object(
        'news_id', NEW.id,
        'slug', NEW.slug,
        'trigger_reason', 'analysis_blocks_updated',
        'updated_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after news_rss_items updates
DROP TRIGGER IF EXISTS trigger_news_analysis_cache_update ON news_rss_items;

CREATE TRIGGER trigger_news_analysis_cache_update
  AFTER UPDATE ON news_rss_items
  FOR EACH ROW
  WHEN (
    OLD.news_analysis IS DISTINCT FROM NEW.news_analysis OR
    OLD.key_points IS DISTINCT FROM NEW.key_points OR
    OLD.themes IS DISTINCT FROM NEW.themes OR
    OLD.keywords IS DISTINCT FROM NEW.keywords
  )
  EXECUTE FUNCTION handle_news_analysis_update();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_news_analysis_cache_update ON news_rss_items IS 
'Automatically refreshes cache when analysis blocks (Key Takeaways, Why It Matters, Context & Background, What Happens Next, FAQ, Mentioned Entities, Source) are updated';

COMMENT ON FUNCTION handle_news_analysis_update() IS 
'Trigger function to refresh news page cache when analytical content blocks are updated. This ensures that SSR pages immediately reflect updated analysis content for search engines and social media crawlers.';