ALTER TABLE news_rss_items 
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_model text,
  ADD COLUMN IF NOT EXISTS llm_processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_news_rss_llm_provider 
  ON news_rss_items(llm_provider, llm_processed_at) 
  WHERE llm_provider IS NOT NULL;
