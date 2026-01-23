-- Типи для нарративів
CREATE TYPE public.narrative_source AS ENUM (
  'author',
  'character', 
  'inconspicuous',
  'polyphonic'
);

CREATE TYPE public.narrative_structure AS ENUM (
  'linear',
  'retrospective',
  'flashforward',
  'circular',
  'parallel',
  'episodic'
);

CREATE TYPE public.narrative_purpose AS ENUM (
  'informational',
  'evaluative',
  'artistic',
  'instructive',
  'identificational'
);

CREATE TYPE public.narrative_plot AS ENUM (
  'overcoming_monster',
  'rags_to_riches',
  'quest',
  'comedy',
  'tragedy',
  'resurrection',
  'forbidden',
  'mystery'
);

CREATE TYPE public.narrative_special AS ENUM (
  'conspiratorial',
  'transmedia',
  'personal',
  'corporate',
  'escapist',
  'propaganda'
);

CREATE TYPE public.story_status AS ENUM (
  'draft',
  'scheduled',
  'published'
);

-- Налаштування системи
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_generation_enabled BOOLEAN DEFAULT true,
  generation_interval_hours INTEGER DEFAULT 6,
  last_auto_generation TIMESTAMP WITH TIME ZONE,
  narrative_source narrative_source DEFAULT 'author',
  narrative_structure narrative_structure DEFAULT 'linear',
  narrative_purpose narrative_purpose DEFAULT 'artistic',
  narrative_plot narrative_plot DEFAULT 'quest',
  narrative_special narrative_special DEFAULT 'escapist',
  bradbury_weight INTEGER DEFAULT 33 CHECK (bradbury_weight >= 0 AND bradbury_weight <= 100),
  clarke_weight INTEGER DEFAULT 33 CHECK (clarke_weight >= 0 AND clarke_weight <= 100),
  gaiman_weight INTEGER DEFAULT 34 CHECK (gaiman_weight >= 0 AND gaiman_weight <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Вставляємо дефолтні налаштування
INSERT INTO public.settings (id) VALUES (gen_random_uuid());

-- Томи (місяці)
CREATE TABLE public.volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  cover_image_url TEXT,
  cover_image_prompt TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(year, month)
);

-- Глави (тижні)
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID REFERENCES public.volumes(id) ON DELETE CASCADE NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  week_of_month INTEGER NOT NULL CHECK (week_of_month >= 1 AND week_of_month <= 5),
  narrator_monologue TEXT,
  narrator_commentary TEXT,
  cover_image_url TEXT,
  cover_image_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Частини (дні)
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_html TEXT,
  date DATE NOT NULL,
  status story_status DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  cover_image_url TEXT,
  cover_image_prompt TEXT,
  news_sources JSONB DEFAULT '[]'::jsonb,
  narrative_source narrative_source,
  narrative_structure narrative_structure,
  narrative_purpose narrative_purpose,
  narrative_plot narrative_plot,
  narrative_special narrative_special,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date)
);

-- Новини
CREATE TABLE public.news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
  external_id TEXT,
  source_name TEXT,
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  category TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_in_generation BOOLEAN DEFAULT false
);

-- Генерації (історія генерацій)
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('story', 'image', 'summary')),
  prompt TEXT,
  result TEXT,
  model_used TEXT,
  news_used JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Функція для оновлення updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Тригери для updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_volumes_updated_at
  BEFORE UPDATE ON public.volumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS - публічний доступ на читання
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Всі можуть читати опублікований контент
CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "Anyone can read volumes"
  ON public.volumes FOR SELECT USING (true);

CREATE POLICY "Anyone can read chapters"
  ON public.chapters FOR SELECT USING (true);

CREATE POLICY "Anyone can read published parts"
  ON public.parts FOR SELECT USING (status = 'published' OR true);

CREATE POLICY "Anyone can read news items"
  ON public.news_items FOR SELECT USING (true);

-- Службовий доступ для edge functions (через service role)
CREATE POLICY "Service can insert settings"
  ON public.settings FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update settings"
  ON public.settings FOR UPDATE USING (true);

CREATE POLICY "Service can manage volumes"
  ON public.volumes FOR ALL USING (true);

CREATE POLICY "Service can manage chapters"
  ON public.chapters FOR ALL USING (true);

CREATE POLICY "Service can manage parts"
  ON public.parts FOR ALL USING (true);

CREATE POLICY "Service can manage news"
  ON public.news_items FOR ALL USING (true);

CREATE POLICY "Service can manage generations"
  ON public.generations FOR ALL USING (true);

-- Індекси для швидкості
CREATE INDEX idx_parts_date ON public.parts(date);
CREATE INDEX idx_parts_status ON public.parts(status);
CREATE INDEX idx_chapters_volume ON public.chapters(volume_id);
CREATE INDEX idx_news_part ON public.news_items(part_id);
CREATE INDEX idx_generations_part ON public.generations(part_id);