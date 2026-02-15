import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use SERVICE_ROLE_KEY to bypass RLS first to confirm it works with admin rights
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Use PUBLIC_KEY (anon key) to simulate frontend request if possible, but frontend uses session token. Here we test if deletion works at all.

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testDelete() {
    console.log('Creating a test feed...');
    // 1. Create a dummy feed
    const { data: feed, error: insertError } = await supabase
        .from('news_rss_feeds')
        .insert({
            name: 'Test Feed For Deletion',
            url: 'https://example.com/rss-test-delete.xml',
            country_id: 'd9b75a6c-9413-4c5e-9963-35316311652f', // Assuming a valid country ID exists, checking first
        })
        .select()
        .single();

    if (insertError) {
        // If country_id is issue, try to fetch one first
        console.log('Insert failed, trying to find a country first...');
        const { data: country } = await supabase.from('news_countries').select('id').limit(1).single();
        if (!country) {
            console.error('No countries found!');
            return;
        }

        const { data: feed2, error: insertError2 } = await supabase
            .from('news_rss_feeds')
            .insert({
                name: 'Test Feed For Deletion',
                url: 'https://example.com/rss-test-delete.xml',
                country_id: country.id
            })
            .select()
            .single();

        if (insertError2) {
            console.error('Failed to create test feed:', insertError2);
            return;
        }
        console.log('Created test feed:', feed2.id);

        // 2. Try to delete it
        console.log('Attempting to delete test feed...');
        const { error: deleteError } = await supabase
            .from('news_rss_feeds')
            .delete()
            .eq('id', feed2.id);

        if (deleteError) {
            console.error('Deletion failed:', deleteError);
        } else {
            console.log('Deletion successful!');
        }
    } else {
        console.log('Created test feed:', feed.id);
        // 2. Try to delete it
        console.log('Attempting to delete test feed...');
        const { error: deleteError } = await supabase
            .from('news_rss_feeds')
            .delete()
            .eq('id', feed.id);

        if (deleteError) {
            console.error('Deletion failed:', deleteError);
        } else {
            console.log('Deletion successful!');
        }
    }
}

testDelete();
