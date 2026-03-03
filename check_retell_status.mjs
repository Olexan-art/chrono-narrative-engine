import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

let envFile = '';
try {
    envFile = fs.readFileSync('.env.development.local', 'utf8');
} catch (e) {
    try {
        envFile = fs.readFileSync('.env.production', 'utf8');
    } catch (e2) {
        try {
            envFile = fs.readFileSync('.env', 'utf8');
        } catch (e3) {
            console.error("Could not read any .env file");
        }
    }
}

const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/['"]/g, '');
    }
});

const url = env['VITE_SUPABASE_URL'] || 'https://tuledxqigzufkecztnlo.supabase.co';
const key = env['VITE_SUPABASE_ANON_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';
const supabase = createClient(url, key);

async function checkStatus() {
    console.log("Checking News Retell Status...");

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Total news in last 24h
    const { count: total24h, error: e1 } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .gte('fetched_at', yesterday);

    if (e1) console.error("Error fetching total24h:", e1);

    // Retold news in last 24h (has key_points)
    const { count: retold24h, error: e2 } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .gte('fetched_at', yesterday)
        .not('key_points', 'is', null);

    if (e2) console.error("Error fetching retold24h:", e2);

    // Queue (total without key points)
    const { count: queue, error: e3 } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .is('key_points', null);

    if (e3) console.error("Error fetching queue:", e3);

    // Recent errors in logs
    const { data: logs, error: e4 } = await supabase
        .from('cron_logs')
        .select('job_name, event_type, details, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`\nMetrics:`);
    console.log(`- News in queue (waiting for AI): ${queue}`);
    console.log(`- New articles fetched (last 24h): ${total24h}`);
    console.log(`- Successfully retold by AI (last 24h): ${retold24h}`);

    console.log(`\nRecent Retell Job Logs:`);
    logs?.forEach(l => {
        console.log(`[${l.created_at}] ${l.event_type} - ${JSON.stringify(l.details)}`);
    });
}

checkStatus();
