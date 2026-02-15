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

async function dumpSchema() {
    const output = [];
    output.push('--- Dumping Database Schema (News & Wiki Tables) ---');

    // Query to get all tables in public schema
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
        sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'news_%' OR table_name LIKE 'wiki_%' OR table_name = 'settings' OR table_name = 'cron_logs')
      ORDER BY table_name
    `
    });

    if (tablesError) {
        console.error('Error fetching tables:', tablesError);
        return;
    }

    const tableNames = tables.map(t => t.table_name);
    output.push(`Found tables: ${tableNames.join(', ')}`);

    for (const tableName of tableNames) {
        output.push(`\nAnalyzing ${tableName}...`);
        // Get Columns
        const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
            sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `
        });

        if (colError) console.error(`Error fetching columns for ${tableName}:`, colError);
        else if (columns) {
            output.push(`Columns for ${tableName}:`);
            columns.forEach(c => {
                output.push(`  - ${c.column_name} (${c.data_type}) ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`);
            });
        }

        // Get Foreign Keys
        const { data: fks, error: fkError } = await supabase.rpc('exec_sql', {
            sql: `
            SELECT
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.key_column_usage AS kcu
            JOIN information_schema.constraint_column_usage AS ccu
            ON kcu.constraint_name = ccu.constraint_name
            WHERE kcu.table_schema = 'public' AND kcu.table_name = '${tableName}'
        `
        });
        if (!fkError && fks && fks.length > 0) {
            output.push(`  Foreign Keys:`);
            fks.forEach(fk => output.push(`    - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`));
        }
    }

    fs.writeFileSync('schema_dump.txt', output.join('\n'));
    console.log('Schema dump saved to schema_dump.txt');
}

dumpSchema();
