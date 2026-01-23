-- Add chat_dialogue and tweets fields to chapters table (similar to parts)
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS chat_dialogue jsonb DEFAULT '[]'::jsonb;

-- Note: tweets column already exists in chapters table based on schema