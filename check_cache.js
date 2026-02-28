import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Please provide SUPABASE_SERVICE_ROLE_KEY env var");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const path = '/news/us/nvidiaaposs-stock-wrapping-up-tough-week-as-wall-street-focuses-more-on-competition-than-growth';
    const url = `https://bravennow.com${path}`;

    console.log(`Fetching live HTML from ${url}...`);
    const liveRes = await fetch(url);
    const liveHtml = await liveRes.text();

    console.log(`Fetching cached HTML for path ${path}...`);
    const { data, error } = await supabase
        .from('cached_pages')
        .select('html')
        .eq('path', path)
        .single();

    if (error || !data) {
        console.error("Cache fetch error or not found:", error);
        return;
    }

    const cachedHtml = data.html;

    // Look for some common block indicators
    const blocksToCheck = [
        'NarrativeAnalysisBlock',
        'OutrageInkBlock',
        'NewsDigestPanel',
        'TrendingWikiEntities',
        '<article',
        'key_points',
        'themes',
        'keywords'
    ];

    console.log("\n--- Comparison ---");
    for (const block of blocksToCheck) {
        const inLive = liveHtml.includes(block);
        const inCache = cachedHtml.includes(block);
        console.log(`${block.padEnd(25)} | Live: ${inLive ? '✅' : '❌'} | Cache: ${inCache ? '✅' : '❌'}`);
    }

    fs.writeFileSync('C:\\GITHRON\\chrono-narrative-engine\\live.html', liveHtml);
    fs.writeFileSync('C:\\GITHRON\\chrono-narrative-engine\\cached.html', cachedHtml);
    console.log("\nSaved to live.html and cached.html");
}

run();
