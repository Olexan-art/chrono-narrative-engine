-- Remove unique constraint on date field to allow multiple parts per day
ALTER TABLE public.parts DROP CONSTRAINT IF EXISTS parts_date_key;