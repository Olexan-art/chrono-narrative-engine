-- Ensure there is at least one row in settings table
-- Only using columns we are 100% sure exist to avoid errors
INSERT INTO public.settings (rss_check_schedule)
SELECT '1hour'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- Initial grant just in case
GRANT ALL ON public.settings TO service_role;
GRANT SELECT, UPDATE ON public.settings TO authenticated;
GRANT SELECT ON public.settings TO anon;
