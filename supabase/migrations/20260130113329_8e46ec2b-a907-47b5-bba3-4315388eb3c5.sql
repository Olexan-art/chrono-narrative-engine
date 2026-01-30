-- Add V22 Gemini API key column to settings
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS gemini_v22_api_key text;

-- Add comment for clarity
COMMENT ON COLUMN public.settings.gemini_v22_api_key IS 'Gemini API key with V22 prefix for generation';