import fs from 'fs';

try {
    const env = fs.readFileSync('.env.development.local', 'utf8');
    const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
    const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

    if (!urlMatch || !keyMatch) {
        console.error("Could not find keys in .env.development.local");
        process.exit(1);
    }

    const url = urlMatch[1].trim().replace(/['"]/g, '');
    const key = keyMatch[1].trim().replace(/['"]/g, '');

    async function check() {
        const reqUrl = `${url}/rest/v1/news_rss_items?select=id,title,source_scoring&source_scoring=not.is.null&limit=5`;
        const res = await fetch(reqUrl, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        console.log(`Found ${data.length || 0} items with scoring`);
        if (data.length > 0) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    check();
} catch (e) {
    console.error(e);
}
