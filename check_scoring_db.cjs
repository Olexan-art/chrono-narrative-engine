require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase
        .from('news_rss_items')
        .select('id, title, source_scoring')
        .not('source_scoring', 'is', null)
        .limit(5);

    if (error) {
        console.error("DB Error:", error);
    } else {
        console.log("Scored Items found:", data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
