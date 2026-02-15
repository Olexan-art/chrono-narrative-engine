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

const envConfig = loadEnv();
const supabase = createClient(envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    console.log('Checking Recent Cron Logs (last 5):');
    const { data: logs, error: logsError } = await supabase
        .from('cron_logs')
        .select('created_at, job_name, status, message')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logs) {
        logs.forEach(log => console.log(`- [${log.created_at}] ${log.job_name} (${log.status}): ${log.message}`));
    } else {
        console.error(logsError);
    }
}

checkLogs();
