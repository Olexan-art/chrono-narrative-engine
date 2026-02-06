-- Fix outrage_ink_votes to prevent individual voting pattern tracking
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Anyone can view outrage ink votes" ON public.outrage_ink_votes;

-- Create restrictive policy - users can only see their own votes
CREATE POLICY "Users can only see their own votes"
ON public.outrage_ink_votes
FOR SELECT
USING (visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id' OR visitor_id IS NULL);

-- Alternative: Create a view for aggregated vote counts only (safer approach)
CREATE OR REPLACE VIEW public.outrage_ink_vote_counts AS
SELECT 
  outrage_ink_id,
  COUNT(*) FILTER (WHERE vote_type = 'like') as likes,
  COUNT(*) FILTER (WHERE vote_type = 'dislike') as dislikes
FROM public.outrage_ink_votes
GROUP BY outrage_ink_id;