import * as fs from 'fs';

function run() {
    const liveHtml = fs.readFileSync('live.html', 'utf8');
    const cachedHtml = fs.readFileSync('cached.html', 'utf8');

    const blocksToCheck = [
        'Key Takeaways',
        'Full Retelling',
        'Character Reactions',
        'Character Dialogue',
        'Themes',
        'Related People',
        'Entity Intersection Graph',
        'Deep Analysis',
        'Original Source'
    ];

    console.log("--- Comparison ---");
    for (const block of blocksToCheck) {
        const inLive = liveHtml.includes(block);
        const inCache = cachedHtml.includes(block);
        console.log(`${block.padEnd(30)} | Live: ${inLive ? '✅' : '❌'} | Cache: ${inCache ? '✅' : '❌'}`);
    }

    console.log(`\nSizes -> Live: ${liveHtml.length} bytes, Cache: ${cachedHtml.length} bytes`);
}

run();
