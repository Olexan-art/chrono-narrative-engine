
-- Clean up remaining permissive policies on news_votes
DROP POLICY IF EXISTS "Users can update their own votes" ON public.news_votes;
DROP POLICY IF EXISTS "Users can only see their own votes" ON public.news_votes;

-- Clean up remaining permissive policies on outrage_ink_votes
DROP POLICY IF EXISTS "Anyone can update votes" ON public.outrage_ink_votes;
DROP POLICY IF EXISTS "Users can only see their own votes" ON public.outrage_ink_votes;
