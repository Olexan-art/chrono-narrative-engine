-- Add source scoring cron control settings
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS source_scoring_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS source_scoring_zai_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS source_scoring_gemini_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS source_scoring_deepseek_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS source_scoring_openai_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.settings.source_scoring_enabled IS 'Master switch for all source scoring cron jobs';
COMMENT ON COLUMN public.settings.source_scoring_zai_enabled IS 'Enable/disable Z.AI for source scoring (runs every 30 min)';
COMMENT ON COLUMN public.settings.source_scoring_gemini_enabled IS 'Enable/disable Gemini for source scoring (runs hourly at :15)';
COMMENT ON COLUMN public.settings.source_scoring_deepseek_enabled IS 'Enable/disable DeepSeek for source scoring (runs hourly at :30)';
COMMENT ON COLUMN public.settings.source_scoring_openai_enabled IS 'Enable/disable OpenAI for source scoring (runs every 3 hours)';
