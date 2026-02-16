
const baseUrl = "https://bgdwxnoildvvepsoaxrf.supabase.co/functions/v1/db-export?password=1nuendo1&table=";

async function fetchTable(tableName) {
    try {
        console.log(`Fetching ${tableName}...`);
        const resp = await fetch(baseUrl + tableName);

        if (!resp.ok) {
            console.error(`HTTP error for ${tableName}:`, resp.status);
            return null;
        }

        const data = await resp.json();
        if (data.rows && Array.isArray(data.rows)) {
            console.log(`Fetched ${data.rows.length} rows for ${tableName}`);
            return data.rows;
        } else {
            console.error(`Unexpected format for ${tableName}:`, Object.keys(data));
            return null;
        }
    } catch (error) {
        console.error(`Fetch failed for ${tableName}:`, error);
        return null;
    }
}

async function main() {
    const countries = await fetchTable('news_countries');
    const feeds = await fetchTable('news_rss_feeds');

    if (countries && feeds) {
        const fs = await import('fs');

        // Generate SQL
        let sql = '-- Data Migration Script (Deduplicated)\n\n';

        // 1. Countries
        sql += '-- 1. Migrate Countries\n';
        for (const row of countries) {
            // Escape single quotes
            const name = row.name.replace(/'/g, "''");
            const code = row.code;
            const flag = row.flag || '';
            const isActive = row.is_active;
            const retellRatio = row.retell_ratio || 100; // Default if missing

            sql += `INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)\n`;
            sql += `VALUES ('${row.id}', '${name}', '${code}', '${flag}', ${isActive}, ${retellRatio}, '${row.created_at}', '${row.updated_at}')\n`;
            sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;\n\n`;
        }

        // 2. Feeds
        sql += '-- 2. Migrate RSS Feeds\n';
        const seenUrls = new Set();
        let skippedCount = 0;

        for (const row of feeds) {
            const name = row.name.replace(/'/g, "''");
            const url = row.url.replace(/'/g, "''").trim(); // Normalize

            if (seenUrls.has(url)) {
                console.log(`Skipping duplicate URL: ${url}`);
                skippedCount++;
                continue;
            }
            seenUrls.add(url);

            const category = row.category || 'general';
            const isActive = row.is_active;
            const sampleRatio = row.sample_ratio || 1;

            sql += `INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)\n`;
            sql += `VALUES ('${row.id}', '${row.country_id}', '${name}', '${url}', '${category}', ${isActive}, ${sampleRatio}, '${row.created_at}', '${row.updated_at}')\n`;
            sql += `ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;\n\n`;
        }

        console.log(`Skipped ${skippedCount} duplicate feeds.`);
        fs.writeFileSync('migration.sql', sql);
        console.log('Migration script updated and saved to migration.sql');
    }
}

main();
