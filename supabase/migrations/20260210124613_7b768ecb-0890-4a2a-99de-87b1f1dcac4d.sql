
-- Remove permissive INSERT policy on news_votes (votes now go through edge function)
DROP POLICY IF EXISTS "Anyone can vote on news" ON public.news_votes;

-- Only service_role (edge function) can insert/update/delete votes
-- Anon/authenticated users can only read their own vote (for UI state)
CREATE POLICY "Anyone can read votes for counts"
  ON public.news_votes FOR SELECT
  USING (true);

-- Remove permissive INSERT policy on outrage_ink_votes  
DROP POLICY IF EXISTS "Anyone can vote on outrage ink" ON public.outrage_ink_votes;

-- Same pattern for outrage_ink_votes
CREATE POLICY "Anyone can read outrage votes"
  ON public.outrage_ink_votes FOR SELECT
  USING (true);
