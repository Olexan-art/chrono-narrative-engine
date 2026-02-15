-- Allow authenticated users to delete RSS feeds
-- This is necessary because the frontend calls delete directly
DROP POLICY IF EXISTS "Authenticated users can delete RSS feeds" ON public.news_rss_feeds;

CREATE POLICY "Authenticated users can delete RSS feeds"
ON public.news_rss_feeds
FOR DELETE
USING (auth.role() = 'authenticated');

-- Also ensure they can insert and update if not already covered
DROP POLICY IF EXISTS "Authenticated users can insert RSS feeds" ON public.news_rss_feeds;
CREATE POLICY "Authenticated users can insert RSS feeds"
ON public.news_rss_feeds
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update RSS feeds" ON public.news_rss_feeds;
CREATE POLICY "Authenticated users can update RSS feeds"
ON public.news_rss_feeds
FOR UPDATE
USING (auth.role() = 'authenticated');
