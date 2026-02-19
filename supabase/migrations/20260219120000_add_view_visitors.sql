-- Add view_visitors table to track per-entity visitor_id for unique counts
CREATE TABLE IF NOT EXISTS public.view_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  visitor_id text NOT NULL,
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, visitor_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_visitors_entity ON public.view_visitors(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_view_visitors_visitor ON public.view_visitors(visitor_id);

-- Enable RLS
ALTER TABLE public.view_visitors ENABLE ROW LEVEL SECURITY;

-- Service policy
CREATE POLICY IF NOT EXISTS "Service can manage view_visitors"
ON public.view_visitors
FOR ALL
USING (true);

-- Read policy for admin panel
CREATE POLICY IF NOT EXISTS "Anyone can read view_visitors"
ON public.view_visitors
FOR SELECT
USING (true);
