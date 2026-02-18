-- Verification script to check if zai_api_key column exists and has data
DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='settings' 
        AND column_name='zai_api_key'
    ) THEN
        RAISE NOTICE 'Column zai_api_key does NOT exist in table settings';
    ELSE
        RAISE NOTICE 'Column zai_api_key exists';
        
        -- Check if it has data
        IF EXISTS (SELECT 1 FROM settings WHERE zai_api_key IS NOT NULL AND zai_api_key <> '') THEN
            RAISE NOTICE 'Column zai_api_key has data';
        ELSE
            RAISE NOTICE 'Column zai_api_key is empty or NULL';
        END IF;
    END IF;
END $$;
