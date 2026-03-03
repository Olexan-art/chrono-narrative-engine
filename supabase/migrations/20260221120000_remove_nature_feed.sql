-- Remove Nature.com RSS feed and all its news items
-- Delete items first to avoid FK constraint
DELETE FROM public.news_rss_items
WHERE feed_id IN (SELECT id FROM public.news_rss_feeds WHERE url = 'https://www.nature.com/nature.rss');

DELETE FROM public.news_rss_feeds
WHERE url = 'https://www.nature.com/nature.rss';

-- Just in case any orphaned items remain, clean up
DELETE FROM public.news_rss_items
WHERE feed_id NOT IN (SELECT id FROM public.news_rss_feeds);
