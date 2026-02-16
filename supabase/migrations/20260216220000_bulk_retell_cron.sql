-- Add support for bulk news retelling cron jobs
-- This migration extends cron_job_configs to support multiple country-specific retelling jobs

-- Add job_type column for better categorization (optional but recommended)
ALTER TABLE cron_job_configs 
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'general';

-- Update existing jobs with their types
UPDATE cron_job_configs SET job_type = 'news_fetching' WHERE job_name = 'news_fetching';
UPDATE cron_job_configs SET job_type = 'news_retelling' WHERE job_name = 'news_retelling';
UPDATE cron_job_configs SET job_type = 'cache_refresh' WHERE job_name = 'cache_refresh';

-- Add comment to clarify processing_options structure for bulk retelling
COMMENT ON COLUMN cron_job_configs.processing_options IS 
'Configuration options. For bulk_retell jobs: {"country_code": "ua", "time_range": "last_1h"|"all", "llm_model": "gpt-4o", "llm_provider": "openai"}';

-- Create index for efficient querying of bulk retell jobs
CREATE INDEX IF NOT EXISTS idx_cron_job_type ON cron_job_configs(job_type);
CREATE INDEX IF NOT EXISTS idx_cron_job_name_pattern ON cron_job_configs(job_name) WHERE job_name LIKE 'bulk_retell_%';

-- Add metadata index to llm_usage_logs for efficient stats queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_metadata_country ON llm_usage_logs((metadata->>'country_code'), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_metadata_cron_job ON llm_usage_logs((metadata->>'cron_job'), created_at DESC);
