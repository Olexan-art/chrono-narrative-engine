-- Bulletproof fix script for ZAI settings
-- Handles missing updated_at column and non-UUID IDs

DO $$
DECLARE
    settings_id_text TEXT;
    target_key TEXT := '44cf5b8be30143879bae1a2eec028dcb.uAfZ3Sv4jR5qLrvt';
    has_updated_at BOOLEAN;
BEGIN
    -- 1. Try to get any ID (casted to text)
    SELECT id::text INTO settings_id_text FROM public.settings LIMIT 1;

    -- 2. Check if updated_at exists in settings table
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'settings' 
        AND column_name = 'updated_at'
    ) INTO has_updated_at;

    IF settings_id_text IS NULL THEN
        -- 3. If empty, insert. 
        INSERT INTO public.settings (zai_api_key) 
        VALUES (target_key);
        RAISE NOTICE 'Inserted new settings row with ZAI key.';
    ELSE
        -- 4. If exists, update using the fetched ID
        IF has_updated_at THEN
            EXECUTE format('UPDATE public.settings SET zai_api_key = %L, updated_at = now() WHERE id::text = %L', target_key, settings_id_text);
        ELSE
            EXECUTE format('UPDATE public.settings SET zai_api_key = %L WHERE id::text = %L', target_key, settings_id_text);
        END IF;
        RAISE NOTICE 'Updated existing settings row (ID: %).', settings_id_text;
    END IF;
END $$;

-- Verify results
SELECT 
    id, 
    (CASE WHEN zai_api_key IS NOT NULL THEN 'SET (starts with ' || left(zai_api_key, 8) || '...)' ELSE 'NULL' END) as zai_key_status 
FROM public.settings;
