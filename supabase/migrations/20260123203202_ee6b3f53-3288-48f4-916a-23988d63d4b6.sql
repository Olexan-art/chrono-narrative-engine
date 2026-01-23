-- Create view_counts table for analytics
CREATE TABLE public.view_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('part', 'chapter', 'volume')),
  entity_id UUID NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

-- Create daily_views for detailed analytics
CREATE TABLE public.daily_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('part', 'chapter', 'volume')),
  entity_id UUID NOT NULL,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  views INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, view_date)
);

-- Add additional image columns for chapters
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_image_url_2 TEXT;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_image_prompt_2 TEXT;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_image_url_3 TEXT;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_image_prompt_3 TEXT;

-- Add tweets column for chapters (for 8 pseudo tweets)
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS tweets JSONB DEFAULT '[]'::jsonb;

-- Enable RLS on view_counts
ALTER TABLE public.view_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_views ENABLE ROW LEVEL SECURITY;

-- Anyone can read view counts
CREATE POLICY "Anyone can read view counts" ON public.view_counts
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read daily views" ON public.daily_views
  FOR SELECT USING (true);

-- Service can manage view counts
CREATE POLICY "Service can manage view counts" ON public.view_counts
  FOR ALL USING (true);

CREATE POLICY "Service can manage daily views" ON public.daily_views
  FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_view_counts_entity ON public.view_counts(entity_type, entity_id);
CREATE INDEX idx_daily_views_entity_date ON public.daily_views(entity_type, entity_id, view_date);
CREATE INDEX idx_daily_views_date ON public.daily_views(view_date);

-- Add trigger for updated_at
CREATE TRIGGER update_view_counts_updated_at
  BEFORE UPDATE ON public.view_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();