-- Create table for tracking LLM usage
CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'zai', 'openai', 'gemini', 'geminiV22', 'mistral', 'anthropic', 'lovable'
  model TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'retell', 'translate', 'generate_image', 'generate_story', 'format_extract', etc.
  tokens_used INTEGER,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB, -- additional context (news_id, entity_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_time ON llm_usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_operation_time ON llm_usage_logs(operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_success_time ON llm_usage_logs(success, created_at DESC);

-- Create table for cron job configurations
CREATE TABLE IF NOT EXISTS cron_job_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT UNIQUE NOT NULL, -- 'news_fetching', 'news_retelling'
  enabled BOOLEAN DEFAULT true,
  frequency_minutes INTEGER NOT NULL DEFAULT 60,
  countries TEXT[] DEFAULT ARRAY['us', 'ua', 'pl'],
  processing_options JSONB DEFAULT '{}'::jsonb, -- for retelling: {"tags": true, "entities": true, "retelling": true, "key_points": true}
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT, -- 'success', 'failed', 'running'
  last_run_details JSONB, -- stats from last run
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO cron_job_configs (job_name, frequency_minutes, countries, processing_options)
VALUES 
  ('news_fetching', 60, ARRAY['us', 'ua', 'pl'], '{}'::jsonb),
  ('news_retelling', 180, ARRAY['us', 'ua', 'pl'], '{"tags": true, "entities": true, "retelling": true, "key_points": true}'::jsonb)
ON CONFLICT (job_name) DO NOTHING;

-- Enable RLS
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_configs ENABLE ROW LEVEL SECURITY;

-- Create policies (admin only)
CREATE POLICY "Admin can view LLM usage logs" ON llm_usage_logs
  FOR SELECT USING (auth.jwt() ->> 'role' = 'authenticated');

CREATE POLICY "Admin can manage cron configs" ON cron_job_configs
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated');
