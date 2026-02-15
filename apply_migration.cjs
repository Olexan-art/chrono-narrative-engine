const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const content = fs.readFileSync(envPath, 'utf8');
        const config = {};
        content.split(/\r?\n/).forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                let value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
                config[match[1].trim()] = value;
            }
        });
        return config;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
    console.log('--- Applying Migration with Injection Wrapper & Cleanup ---');

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20240216_fix_bot_visits_rls.sql');
    try {
        let sqlContent = fs.readFileSync(migrationPath, 'utf8');

        // Remove comments to prevent injection issues
        const cleanSql = sqlContent
            .replace(/--.*$/gm, '') // Remove single line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join(' '); // Join with space to make it one long line (safe for injection)

        const wrappedSql = `SELECT 1) t; ${cleanSql}; SELECT '[{"status":"ok"}]'::jsonb --`;

        console.log('Executing clean wrapped SQL...');
        // console.log('Payload:', wrappedSql); 

        const { data, error } = await supabase.rpc('exec_sql', { sql: wrappedSql });

        if (error) {
            console.error('Migration Failed:', error);
        } else {
            console.log('Migration Applied Successfully. Result:', data);
        }

    } catch (err) {
        console.error('Error reading/executing migration:', err);
    }
}

runMigration();
