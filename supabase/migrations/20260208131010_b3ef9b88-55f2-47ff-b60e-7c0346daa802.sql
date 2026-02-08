-- Add slug column to wiki_entities for friendly URLs
ALTER TABLE public.wiki_entities 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Update existing entities with unique slugs (adding id suffix for uniqueness)
UPDATE public.wiki_entities 
SET slug = lower(regexp_replace(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ\s-]', '', 'g'),
    '\s+', '-', 'g'
  ),
  '-+', '-', 'g'
)) || '-' || substring(id::text, 1, 8)
WHERE slug IS NULL;

-- Create unique index on slug after update
CREATE UNIQUE INDEX IF NOT EXISTS wiki_entities_slug_idx ON public.wiki_entities(slug) WHERE slug IS NOT NULL;

-- Create function to generate slug from name with uniqueness
CREATE OR REPLACE FUNCTION public.generate_wiki_entity_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Generate base slug from name
  base_slug := lower(regexp_replace(
    regexp_replace(
      regexp_replace(NEW.name, '[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
  
  -- Limit length and add uuid suffix for uniqueness
  IF length(base_slug) > 80 THEN
    base_slug := left(base_slug, 80);
  END IF;
  
  -- Add uuid suffix for guaranteed uniqueness
  NEW.slug := base_slug || '-' || substring(NEW.id::text, 1, 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate slug on insert
DROP TRIGGER IF EXISTS wiki_entity_slug_trigger ON public.wiki_entities;
CREATE TRIGGER wiki_entity_slug_trigger
BEFORE INSERT ON public.wiki_entities
FOR EACH ROW
WHEN (NEW.slug IS NULL)
EXECUTE FUNCTION public.generate_wiki_entity_slug();