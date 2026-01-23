-- Add translated chat_dialogue and tweets columns for parts
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS chat_dialogue_en jsonb;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS chat_dialogue_pl jsonb;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS tweets_en jsonb;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS tweets_pl jsonb;

-- Add translated chat_dialogue and tweets columns for chapters
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS chat_dialogue_en jsonb;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS chat_dialogue_pl jsonb;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS tweets_en jsonb;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS tweets_pl jsonb;