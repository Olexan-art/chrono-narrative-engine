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

async function checkMore() {
    console.log('--- Checking Bot Visits Data Stats ---');

    // Group by status_code
    // Note: Supabase JS client doesn't support GROUP BY easily without rpc usually, but we can use .select
    // and process in memory for small sample or use exec_sql

    const { data: stats, error: statsError } = await supabase.rpc('exec_sql', {
        sql: `
        SELECT status_code, count(*) 
        FROM bot_visits 
        GROUP BY status_code
      `
    });

    if (statsError) console.error('Error stats:', statsError);
    else console.log('Status Codes:', stats);

    console.log('--- Checking Permissions ---');
    const { data: grants, error: grantsError } = await supabase.rpc('exec_sql', {
        sql: `
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'bot_visits'
      `
    });

    if (grantsError) console.error('Error grants:', grantsError);
    else console.log('Grants:', grants);
}

checkMore();
