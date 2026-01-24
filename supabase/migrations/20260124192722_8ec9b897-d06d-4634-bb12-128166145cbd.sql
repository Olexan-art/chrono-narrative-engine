-- Add separate provider fields for text and image models
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS llm_text_provider text DEFAULT 'lovable',
ADD COLUMN IF NOT EXISTS llm_image_provider text DEFAULT 'lovable';