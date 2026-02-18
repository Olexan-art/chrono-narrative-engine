-- Clear SSR cache for pages that display caricatures
-- This forces the pages to re-render and include new content on the next visit

DELETE FROM cached_pages 
WHERE path IN ('/', '/ink-abyss');

-- Optional: verify if carriages exist (just for user to see in results)
SELECT count(*) as total_caricatures FROM outrage_ink;
