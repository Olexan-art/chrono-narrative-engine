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
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('Missing required keys');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function reschedule() {
    console.log('--- Rescheduling Cron Job ---');

    // 1. Unschedule
    console.log('Unscheduling fetch-rss-feeds-hourly...');
    const { error: unscheduleError } = await supabase.rpc('exec_sql', {
        sql: "SELECT cron.unschedule('fetch-rss-feeds-hourly')"
    });

    if (unscheduleError) console.log('Unschedule error (might not exist):', unscheduleError.message);
    else console.log('Unscheduled successfully.');

    // 2. Schedule
    console.log('Scheduling new job (15min)...');
    const cronCommand = `
    SELECT net.http_post(
      url:='${supabaseUrl}/functions/v1/fetch-rss',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
      body:='{"action": "fetch_all"}'::jsonb
    ) as request_id;
  `;

    // Escape single quotes in the command for the outer SQL string
    // Actually, we use $$ quoting for the command in the SQL call, so it handles internal quotes.
    // SQL: SELECT cron.schedule('name', 'schedule', $$command$$)

    const scheduleSql = `SELECT cron.schedule('fetch-rss-feeds-hourly', '*/15 * * * *', $$${cronCommand}$$)`;

    const { data, error: scheduleError } = await supabase.rpc('exec_sql', {
        sql: scheduleSql
    });

    if (scheduleError) {
        console.error('Schedule error:', scheduleError);
    } else {
        console.log('Scheduled successfully:', data);
    }

    // 3. Update Settings Persistence
    console.log('Updating settings table...');
    const { data: settingsRow } = await supabase
        .from('settings')
        .select('id')
        .limit(1)
        .maybeSingle();

    if (settingsRow) {
        const { error: updateError } = await supabase
            .from('settings')
            .update({ rss_check_schedule: '15min' })
            .eq('id', settingsRow.id);

        if (updateError) console.error('Settings update error:', updateError);
        else console.log('Settings updated to 15min.');
    }

    // 4. Verify
    console.log('Verifying...');
    const { data: jobs } = await supabase.rpc('exec_sql', {
        sql: "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fetch-rss-feeds-hourly'"
    });
    console.log('Job Status:', jobs);
}

reschedule();
