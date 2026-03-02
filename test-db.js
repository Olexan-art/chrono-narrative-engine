const url = 'https://tuledxqigzufkecztnlo.supabase.co/rest/v1/news_rss_items?select=id&limit=1';
// Read from local .env
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*?)"/);
const key = keyMatch ? keyMatch[1] : null;

if (!key) {
    console.log('Key not found');
    process.exit(1);
}

async function test() {
    console.log('Pinging Supabase REST API...');
    const start = Date.now();
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        console.log('Status:', res.status);
        console.log('Time:', Date.now() - start, 'ms');
        const text = await res.text();
        console.log('Response:', text.substring(0, 100));
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}
test();
