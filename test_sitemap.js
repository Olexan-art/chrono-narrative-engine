import * as fs from 'fs';

async function run() {
    try {
        const res = await fetch("http://127.0.0.1:54321/functions/v1/ssr-render?path=/sitemap", {
            headers: {
                "User-Agent": "Googlebot"
            }
        });

        if (!res.ok) {
            console.error("HTTP error:", res.status, res.statusText);
            console.error(await res.text());
            return;
        }

        const html = await res.text();
        console.log(`Length: ${html.length}`);
        console.log("Includes 'Main Pages':", html.includes("Main Pages"));
        console.log("Includes 'Entity Catalog':", html.includes("Entity Catalog"));
        console.log("Includes 'News by Country':", html.includes("News by Country"));
        console.log("Includes 'Topics':", html.includes("<h3>Topics"));

        fs.writeFileSync('sitemap_test.html', html);
    } catch (err) {
        console.error(err);
    }
}

run();
