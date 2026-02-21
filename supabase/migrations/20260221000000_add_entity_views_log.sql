-- Add entity_views table for detailed view tracking
CREATE TABLE IF NOT EXISTS public.entity_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  visitor_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entity_views_type_time ON public.entity_views(entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_views_entity ON public.entity_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_views_created_at ON public.entity_views(created_at DESC);

-- Enable RLS
ALTER TABLE public.entity_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service can manage entity_views" ON public.entity_views;
DROP POLICY IF EXISTS "Anyone can read entity_views" ON public.entity_views;

-- Service policy
CREATE POLICY "Service can manage entity_views"
ON public.entity_views
FOR ALL
USING (true);

-- Read policy for analytics
CREATE POLICY "Anyone can read entity_views"
ON public.entity_views
FOR SELECT
USING (true);
