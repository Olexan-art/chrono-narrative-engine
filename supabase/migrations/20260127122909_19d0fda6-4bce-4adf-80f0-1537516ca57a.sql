-- Add settings for dialogue and tweet counts in auto-generation
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS news_dialogue_count integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS news_tweet_count integer DEFAULT 4;

-- Add comment for clarity
COMMENT ON COLUMN public.settings.news_dialogue_count IS 'Number of dialogue messages to generate (5-10)';
COMMENT ON COLUMN public.settings.news_tweet_count IS 'Number of tweets to generate (3-6)';