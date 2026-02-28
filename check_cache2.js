import * as fs from 'fs';

function run() {
    const liveHtml = fs.readFileSync('live.html', 'utf8');
    const cachedHtml = fs.readFileSync('cached.html', 'utf8');

    // Look for some common block classes or indicators in the generated HTML
    const blocksToCheck = [
        'news-analysis-block',        // NarrativeAnalysisBlock
        'outrage-ink-mini',           // OutrageInkBlock
        'news-digest',               // NewsDigestPanel
        'trending-entities',         // TrendingWikiEntities
        'entity-tags',               // NewsWikiEntities / EntityTags
        'key-points',                // Key points block
        'themes-container'           // Themes block
    ];

    console.log("--- Comparison ---");
    for (const block of blocksToCheck) {
        const inLive = liveHtml.includes(block);
        const inCache = cachedHtml.includes(block);
        console.log(`${block.padEnd(25)} | Live: ${inLive ? '✅' : '❌'} | Cache: ${inCache ? '✅' : '❌'}`);
    }

    console.log(`\nSizes -> Live: ${liveHtml.length} bytes, Cache: ${cachedHtml.length} bytes`);
}

run();
