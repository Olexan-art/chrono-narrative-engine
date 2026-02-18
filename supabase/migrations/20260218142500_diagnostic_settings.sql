-- Diagnostic script to check settings table and ZAI key
-- Run this in Supabase SQL Editor

-- 1. Check if table has rows
SELECT count(*) as row_count FROM public.settings;

-- 2. Check all columns in the settings table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'settings';

-- 3. Check for specific variants of the ZAI key column
SELECT 
    (SELECT count(*) FROM information_schema.columns WHERE table_name='settings' AND column_name='zai_api_key') as has_underscores,
    (SELECT count(*) FROM information_schema.columns WHERE table_name='settings' AND column_name='zai-api-key') as has_dashes;

-- 4. Try to find the key regardless of column name (if it exists)
-- (This is just for diagnostics, don't share keys in public usually)
-- We'll check if any column contains something that looks like the user's reported key
-- but only checking for presence/emptiness
SELECT id, 
       (CASE WHEN zai_api_key IS NOT NULL THEN 'SET' ELSE 'NULL' END) as zai_key_status 
FROM public.settings;
