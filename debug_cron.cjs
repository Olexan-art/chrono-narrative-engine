const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        console.log('Loading .env from:', envPath);
        if (!fs.existsSync(envPath)) {
            console.error('File does not exist!');
            return {};
        }
        const content = fs.readFileSync(envPath, 'utf8');
        const config = {};
        const lines = content.split(/\r?\n/); // Handle CRLF

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const idx = trimmed.indexOf('=');
            if (idx === -1) return;

            const key = trimmed.slice(0, idx).trim();
            let value = trimmed.slice(idx + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            config[key] = value;
            // console.log(`Loaded key: ${key}`); // Uncomment to debug keys if needed (don't print values)
        });
        return config;
    } catch (e) {
        console.error('Error loading .env:', e.message);
        return {};
    }
}

const envConfig = loadEnv();
console.log('Keys found:', Object.keys(envConfig));

const supabaseUrl = envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCron() {
    console.log('--- Debugging RSS Automation ---');

    // 1. Check Settings
    console.log('\n1. Checking Settings Table:');
    const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .limit(1);

    if (settingsError) {
        console.error('Error fetching settings:', settingsError);
    } else {
        // Only print relevant fields
        const safeSettings = settings ? settings.map(s => ({
            id: s.id,
            rss_check_schedule: s.rss_check_schedule,
            auto_generation_enabled: s.auto_generation_enabled
        })) : [];
        console.log('Settings:', safeSettings);
    }

    // 2. Check Cron Jobs (via RPC)
    console.log('\n2. Checking Cron Jobs (cron.job table):');
    try {
        const { data: cronJobs, error: cronError } = await supabase.rpc('exec_sql', {
            sql: "SELECT jobid, jobname, schedule, active, command FROM cron.job"
        });

        if (cronError) {
            console.error('Error fetching cron jobs directly:', cronError);
        } else {
            console.log('Cron Jobs found:', cronJobs ? cronJobs.length : 0);
            if (cronJobs) {
                cronJobs.forEach(job => {
                    console.log(`- [${job.active ? 'ACTIVE' : 'INACTIVE'}] ${job.jobname}: ${job.schedule}`);
                });
            }
        }

    } catch (e) {
        console.error('Error checking cron jobs:', e);
    }

    // 3. Check Cron Logs
    console.log('\n3. Checking Recent Cron Logs (last 5):');
    const { data: logs, error: logsError } = await supabase
        .from('cron_logs')
        .select('created_at, job_name, status, message')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logsError) {
        // console.error('Error fetching logs:', logsError); // Table might not exist yet?
        if (logsError.code === '42P01') {
            console.log('cron_logs table does not exist yet.');
        } else {
            console.error('Error fetching logs:', logsError);
        }
    } else {
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                console.log(`- [${log.created_at}] ${log.job_name} (${log.status}): ${log.message}`);
            });
        } else {
            console.log('No cron logs found.');
        }
    }
    // 4. Manually Invoke fetch-rss
    console.log('\n4. Manually Invoking fetch-rss (action: fetch_all):');
    try {
        const fnUrl = `${envConfig.SUPABASE_URL || envConfig.VITE_SUPABASE_URL}/functions/v1/fetch-rss`;
        const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

        console.log('Invoking:', fnUrl);
        const start = Date.now();
        const response = await fetch(fnUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({ action: 'fetch_all' })
        });

        const duration = Date.now() - start;
        console.log(`Duration: ${duration}ms`);
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const text = await response.text();
            console.log('Response:', text.slice(0, 500) + (text.length > 500 ? '...' : ''));
        } else {
            const text = await response.text();
            console.error('Error Response:', text);
        }

    } catch (e) {
        console.error('Error invoking function:', e);
    }
}

debugCron();
