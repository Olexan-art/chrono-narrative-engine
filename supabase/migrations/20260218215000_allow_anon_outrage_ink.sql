-- Allow anyone (anon) to insert/update caricatures
-- This matches the storage policy and allows the frontend to save data after manual upload
-- Note: Authentication is handled by the application's admin panel password, 
-- but Supabase RLS is bypassed for this specific table to simplify the admin flow.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outrage_ink' AND schemaname = 'public' AND policyname = 'Anyone can insert outrage ink') THEN
        CREATE POLICY "Anyone can insert outrage ink" ON public.outrage_ink FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outrage_ink' AND schemaname = 'public' AND policyname = 'Anyone can update outrage ink') THEN
        CREATE POLICY "Anyone can update outrage ink" ON public.outrage_ink FOR UPDATE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'outrage_ink' AND schemaname = 'public' AND policyname = 'Anyone can delete outrage ink') THEN
        CREATE POLICY "Anyone can delete outrage ink" ON public.outrage_ink FOR DELETE USING (true);
    END IF;
END $$;
