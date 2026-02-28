async function run() {
    const url = 'https://tuledxqigzufkecztnlo.supabase.co/rest/v1/llm_processing_logs?select=*&limit=1';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';
    try {
        const res = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const data = await res.json();
        console.log("llm_processing_logs data/error:", data);

        // Also let's check exact count of news_rss_items retold in the last 30 mins using created_at/fetched_at/translated_at ?
        // Check columns of news_rss_items: id, feed_id, country_id, external_id, title, link, summary, published_at, fetched_at, created_at, content_en, translated_at, is_flash_news, translation_status, audio_source_url, source_host, video_id, author, full_html_content, slug, status, priority, is_archived, content_pl, translated_pl_at, translation_pl_status, author_pl, summary_pl, title_pl, summary_en, title_en, themes, narrative_analysis_completed, news_analysis, viral_simulation_started_at, viral_simulation_completed
        // The relevant fields are `translated_at` (when it was translated/retold) or we can just check `translated_at > (now - 30m)`.

        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const retoldUrl = `https://tuledxqigzufkecztnlo.supabase.co/rest/v1/news_rss_items?select=id,title_en,translated_at&translated_at=gte.${thirtyMinsAgo}&limit=100`;
        const retoldRes = await fetch(retoldUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const retoldData = await retoldRes.json();
        console.log("\nRetold in last 30 mins (using translated_at):", retoldData.length || retoldData);
    } catch (e) { console.error(e) }
}
run();
