
const exportUrl = "https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/db-export?password=1nuendo1&table=news_rss_feeds";

async function main() {
    try {
        console.log("Fetching export...");
        const resp = await fetch(exportUrl);

        console.log("Status:", resp.status);
        console.log("Content-Type:", resp.headers.get("content-type"));

        if (!resp.ok) {
            console.error("HTTP error:", resp.status);
            const text = await resp.text();
            console.error("Error body:", text);
            process.exit(1);
        }

        const text = await resp.text();
        console.log("Raw response length:", text.length);
        console.log("Raw preview:", text.slice(0, 200));

        try {
            const data = JSON.parse(text);
            console.log("Data type:", typeof data);
            console.log("Is array?", Array.isArray(data));

            if (!Array.isArray(data)) {
                console.log("Keys:", Object.keys(data));
                console.log("Preview:", JSON.stringify(data, null, 2).slice(0, 500));
                // If it's something like { data: [...] } handle it
                if (data.data && Array.isArray(data.data)) {
                    console.log("Found nested 'data' array with length:", data.data.length);
                    const fs = await import('fs');
                    fs.writeFileSync('feeds_export.json', JSON.stringify(data.data, null, 2));
                    console.log('Saved data.data to feeds_export.json');
                } else {
                    const fs = await import('fs');
                    fs.writeFileSync('feeds_export_raw.json', JSON.stringify(data, null, 2));
                    console.log('Saved raw object to feeds_export_raw.json');
                }
            } else {
                console.log(`Total items: ${data.length}`);
                const fs = await import('fs');
                fs.writeFileSync('feeds_export.json', JSON.stringify(data, null, 2));
                console.log('Saved to feeds_export.json');
            }

        } catch (e) {
            console.error("JSON parse error:", e);
        }

    } catch (error) {
        console.error("Fetch failed:", error);
    }
}

main();
