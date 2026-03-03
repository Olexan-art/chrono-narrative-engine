import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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

async function clearOldQueue() {
    console.log("Clearing news older than 6 hours from retell queue...");

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // First count how many there are
    const { count, error: countError } = await supabase
        .from('news_rss_items')
        .select('id', { count: 'exact', head: true })
        .is('key_points', null)
        .lt('fetched_at', sixHoursAgo);

    if (countError) {
        console.error("Error fetching count:", countError.message);
        return;
    }

    console.log(`Found ${count} items older than 6 hours in the queue.`);

    if (count === 0) {
        console.log("Nothing to clear.");
        return;
    }

    // Now update them in batches
    // Supabase REST API has a limit of 1000 rows per update, but using `eq` or similar condition can update multiple.
    // However, we should be careful with large updates on Supabase REST API (usually it's better to do via RPC, or in chunks).
    // Let's do it via Supabase update with filtering.

    // Instead of doing it directly which might timeout or hit row limits, let's use an RPC if one exists, 
    // or just fetch IDs and update in chunks. 
    // We'll update the key_points to `'[]'::jsonb` so it's not null anymore.

    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
        const { data: chunk, error: fetchError } = await supabase
            .from('news_rss_items')
            .select('id')
            .is('key_points', null)
            .lt('fetched_at', sixHoursAgo)
            .limit(100);

        if (fetchError) {
            console.error("Fetch error:", fetchError);
            break;
        }

        if (!chunk || chunk.length === 0) {
            hasMore = false;
            break;
        }

        const idsToUpdate = chunk.map(c => c.id);

        const { error: updateError } = await supabase
            .from('news_rss_items')
            .update({ key_points: [{ type: 'skipped', reason: 'older_than_6_hours' }] })
            .in('id', idsToUpdate);

        if (updateError) {
            console.error("Update error for chunk:", updateError);
            break;
        }

        totalUpdated += idsToUpdate.length;
        console.log(`Updated ${totalUpdated} / ${count} items...`);
    }

    console.log("Done.");
}

clearOldQueue();
