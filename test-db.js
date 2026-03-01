import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL;
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: article, error } = await supabase
        .from('news_rss_items')
        .select('id, title, key_points, key_points_en, themes, themes_en, keywords, news_analysis')
        .eq('slug', 'berkshire-hathaway-operating-earnings-fell-nearly-30-in-warren-buffettaposs-final-quarter-as-ceo')
        .single();

    if (error) {
        console.error('Error fetching article:', error);
        return;
    }

    if (article) {
        const { data: entities } = await supabase
            .from('news_wiki_entities')
            .select('id, match_term, wiki_entity_id')
            .eq('news_item_id', article.id);

        console.log('ARTICLE METADATA:', JSON.stringify(article, null, 2));
        console.log('WIKI ENTITIES COUNT:', entities?.length || 0);
        console.log('WIKI ENTITIES DATA:', JSON.stringify(entities, null, 2));
    } else {
        console.log('Article not found.');
    }
}

run();
