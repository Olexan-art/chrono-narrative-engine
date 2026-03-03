-- Add deepseek_api_key to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT;
