async function run() {
    const url = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1/retell-news';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    try {
        // get a recent unretold news item
        const itemsUrl = `https://tuledxqigzufkecztnlo.supabase.co/rest/v1/news_rss_items?select=id,title_en&content_en=is.null&limit=1`;
        const itemsRes = await fetch(itemsUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const itemsData = await itemsRes.json();

        if (itemsData.length === 0) { console.log('No items to retell'); return; }

        const newsId = itemsData[0].id;
        console.log(`Trying to retell news_id: ${newsId}`);

        const payload = { newsId: newsId };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const status = res.status;
        const data = await res.text();
        console.log(`Status: ${status}`);
        console.log(`Response: ${data}`);
    } catch (e) { console.error(e) }
}
run();
