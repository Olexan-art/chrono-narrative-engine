import * as fs from 'fs';

function run() {
    const liveHtml = fs.readFileSync('live.html', 'utf8');
    const cachedHtml = fs.readFileSync('cached.html', 'utf8');

    const blocksToCheck = [
        'Narrative Analysis',
        'Outrage Ink',
        'News Source',
        'Deep Analysis'
    ];

    console.log("--- Comparison ---");
    for (const block of blocksToCheck) {
        const inLive = liveHtml.includes(block);
        const inCache = cachedHtml.includes(block);
        console.log(`${block.padEnd(30)} | Live: ${inLive ? '✅' : '❌'} | Cache: ${inCache ? '✅' : '❌'}`);
    }
}

run();
