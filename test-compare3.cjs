const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let envFile;
try {
    envFile = fs.readFileSync('.env', 'utf8');
} catch (e) {
    console.error('Could not read .env: ', e.message);
    process.exit(1);
}

const env = {};
envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing URL or Key in env file");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const slugs = [
        'berkshire-hathaway-operating-earnings-fell-nearly-30-in-warren-buffettaposs-final-quarter-as-ceo',
        'form-13da-zivo-bioscience-for-27-february'
    ];

    for (const slug of slugs) {
        const { data: article, error: fetchError } = await supabase
            .from('news_rss_items')
            .select('id, title, key_points, key_points_en, themes, themes_en, keywords, news_analysis')
            .eq('slug', slug)
            .single();

        console.log(`\n\n=== ARTICLE: ${slug} ===`);
        if (fetchError) {
            console.log('Error fetching:', fetchError.message);
            continue;
        }

        if (article) {
            console.log('KEY POINTS EN:', !!article.key_points_en, Array.isArray(article.key_points_en) ? article.key_points_en.length : 'Not Array');
            console.log('KEY POINTS UA/PL:', !!article.key_points, Array.isArray(article.key_points) ? article.key_points.length : 'Not Array');
            console.log('THEMES EN:', !!article.themes_en, Array.isArray(article.themes_en) ? article.themes_en.length : 'Not Array');
            console.log('THEMES UA/PL:', !!article.themes, Array.isArray(article.themes) ? article.themes.length : 'Not Array');

            const { data: entities } = await supabase
                .from('news_wiki_entities')
                .select('*')
                .eq('news_item_id', article.id);

            console.log('WIKI ENTITIES COUNT:', entities?.length || 0);
        } else {
            console.log('Article not found in database.');
        }
    }
}

run();
