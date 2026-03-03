-- Add insert/update/delete policies for outrage_ink (admin operations)
DROP POLICY IF EXISTS "Anyone can insert outrage ink" ON public.outrage_ink;
CREATE POLICY "Anyone can insert outrage ink" ON public.outrage_ink FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update outrage ink" ON public.outrage_ink;
CREATE POLICY "Anyone can update outrage ink" ON public.outrage_ink FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete outrage ink" ON public.outrage_ink;
CREATE POLICY "Anyone can delete outrage ink" ON public.outrage_ink FOR DELETE USING (true);

-- Add update policy for votes (to handle upsert)
DROP POLICY IF EXISTS "Anyone can update votes" ON public.outrage_ink_votes;
CREATE POLICY "Anyone can update votes" ON public.outrage_ink_votes FOR UPDATE USING (true);

-- Add insert/update/delete policies for entities
DROP POLICY IF EXISTS "Anyone can insert outrage ink entities" ON public.outrage_ink_entities;
CREATE POLICY "Anyone can insert outrage ink entities" ON public.outrage_ink_entities FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update outrage ink entities" ON public.outrage_ink_entities;
CREATE POLICY "Anyone can update outrage ink entities" ON public.outrage_ink_entities FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete outrage ink entities" ON public.outrage_ink_entities;
CREATE POLICY "Anyone can delete outrage ink entities" ON public.outrage_ink_entities FOR DELETE USING (true);