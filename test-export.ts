
const exportUrl = "https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/db-export?password=1nuendo1&table=news_rss_feeds";

try {
    console.log("Fetching export...");
    const resp = await fetch(exportUrl);
    if (!resp.ok) {
        console.error("HTTP error:", resp.status);
        const text = await resp.text();
        console.error(text);
        Deno.exit(1);
    }
    const data = await resp.json();
    console.log("Success! Data preview (first 2 items):");
    console.log(JSON.stringify(data.slice(0, 2), null, 2));
    console.log(`Total items: ${data.length}`);
} catch (error) {
    console.error("Fetch failed:", error);
}
