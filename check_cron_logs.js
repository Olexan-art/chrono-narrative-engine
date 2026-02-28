async function run() {
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    try {
        const url = `https://tuledxqigzufkecztnlo.supabase.co/rest/v1/cron_job_events?select=*&order=created_at.desc&limit=5`;
        const res = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const data = await res.json();
        console.log("Recent cron logs:");
        data.forEach(d => console.log(JSON.stringify(d, null, 2)));

        // also check how many in last 30m
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const itemsUrl = `https://tuledxqigzufkecztnlo.supabase.co/rest/v1/news_rss_items?select=id,title_en,fetched_at,created_at&fetched_at=gte.${thirtyMinsAgo}&limit=10`;
        const itemsRes = await fetch(itemsUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const itemsData = await itemsRes.json();
        console.log(`\nItems fetched (scraped) in last 30 mins: ${itemsData.length}`);
    } catch (e) { console.error(e) }
}
run();
