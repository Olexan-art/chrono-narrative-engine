-- Add auto-generation settings for news RSS items
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS news_auto_retell_enabled boolean DEFAULT true;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS news_auto_dialogue_enabled boolean DEFAULT true;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS news_auto_tweets_enabled boolean DEFAULT true;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS news_retell_ratio integer DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN public.settings.news_auto_retell_enabled IS 'Автоматично переказувати новини при додаванні з RSS';
COMMENT ON COLUMN public.settings.news_auto_dialogue_enabled IS 'Автоматично генерувати діалоги для нових новин';
COMMENT ON COLUMN public.settings.news_auto_tweets_enabled IS 'Автоматично генерувати твіти для нових новин';
COMMENT ON COLUMN public.settings.news_retell_ratio IS 'Переказувати кожну N-ту новину (1 = всі, 5 = кожну 5-ту)';