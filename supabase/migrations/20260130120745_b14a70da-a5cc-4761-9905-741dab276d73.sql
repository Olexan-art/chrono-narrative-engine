-- Add Mistral API key column
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS mistral_api_key TEXT;