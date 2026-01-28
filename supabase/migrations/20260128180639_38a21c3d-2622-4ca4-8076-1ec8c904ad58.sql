-- Add Z.AI API key column to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS zai_api_key TEXT;