-- Add insert/update/delete policies for outrage_ink (admin operations)
CREATE POLICY "Anyone can insert outrage ink" ON public.outrage_ink FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update outrage ink" ON public.outrage_ink FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete outrage ink" ON public.outrage_ink FOR DELETE USING (true);

-- Add update policy for votes (to handle upsert)
CREATE POLICY "Anyone can update votes" ON public.outrage_ink_votes FOR UPDATE USING (true);

-- Add insert/update/delete policies for entities
CREATE POLICY "Anyone can insert outrage ink entities" ON public.outrage_ink_entities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update outrage ink entities" ON public.outrage_ink_entities FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete outrage ink entities" ON public.outrage_ink_entities FOR DELETE USING (true);