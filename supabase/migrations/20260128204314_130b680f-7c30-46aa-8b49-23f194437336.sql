-- Add cache_status column to bot_visits for tracking HIT/MISS
ALTER TABLE public.bot_visits 
ADD COLUMN IF NOT EXISTS cache_status TEXT;

-- Add index for cache_status filtering
CREATE INDEX IF NOT EXISTS idx_bot_visits_cache_status ON public.bot_visits(cache_status);

-- Comment for documentation
COMMENT ON COLUMN public.bot_visits.cache_status IS 'SSR cache status: HIT or MISS';