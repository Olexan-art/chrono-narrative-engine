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

async function checkExtensions() {
    console.log('Checking pg_cron extension...');
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: "SELECT * FROM pg_extension WHERE extname = 'pg_cron'"
    });

    if (error) console.error(error);
    else console.log('Extensions:', data);

    console.log('Checking schemas...');
    const { data: schemas, error: schemaError } = await supabase.rpc('exec_sql', {
        sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cron'"
    });

    if (schemaError) console.error(schemaError);
    else console.log('Schemas:', schemas);
}

checkExtensions();
