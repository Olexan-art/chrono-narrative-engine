-- Add LLM configuration fields to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'lovable',
ADD COLUMN IF NOT EXISTS llm_text_model TEXT DEFAULT 'google/gemini-3-flash-preview',
ADD COLUMN IF NOT EXISTS llm_image_model TEXT DEFAULT 'google/gemini-3-pro-image-preview',
ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;