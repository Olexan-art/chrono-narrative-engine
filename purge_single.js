import * as fs from 'fs';

async function run() {
    const path = '/news/us/nvidiaaposs-stock-wrapping-up-tough-week-as-wall-street-focuses-more-on-competition-than-growth';
    try {
        const res = await fetch(`https://bravennow.com/api/cache-purge?secret=bnn-cache-purge-key-2026&action=purge_path&path=${path}`, {
            method: 'POST'
        });
        console.log(await res.json());
    } catch (err) {
        console.error(err);
    }
}

run();
