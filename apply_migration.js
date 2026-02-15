import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20240215_rss_automation_improvements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration...');

    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.error('Error applying migration:', error);
    } else {
        console.log('Migration applied successfully!');
    }
}

applyMigration();
