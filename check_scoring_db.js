async function check() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        console.error("Missing credentials in environment variables.");
        return;
    }

    const url = `${supabaseUrl}/rest/v1/news_rss_items?select=id,title,source_scoring&source_scoring=not.is.null&limit=5`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
            }
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log(`Found ${data.length} items with scoring:`);
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

check();
