-- Add character relationships table
CREATE TABLE public.character_relationships (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
    related_character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
    relationship_type text NOT NULL CHECK (relationship_type IN ('friendly', 'hostile', 'neutral')),
    strength integer NOT NULL DEFAULT 50 CHECK (strength >= 0 AND strength <= 100),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(character_id, related_character_id)
);

-- Enable RLS
ALTER TABLE public.character_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read character relationships" 
ON public.character_relationships 
FOR SELECT 
USING (true);

CREATE POLICY "Service can manage character relationships" 
ON public.character_relationships 
FOR ALL 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_character_relationships_updated_at
BEFORE UPDATE ON public.character_relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add dialogue statistics columns to characters table
ALTER TABLE public.characters 
ADD COLUMN dialogue_count integer NOT NULL DEFAULT 0,
ADD COLUMN total_likes integer NOT NULL DEFAULT 0,
ADD COLUMN last_dialogue_at timestamp with time zone;