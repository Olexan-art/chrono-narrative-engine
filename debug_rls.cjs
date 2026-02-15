const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    console.log('Checking RLS policies for news_rss_feeds...');

    const { data, error } = await supabase.rpc('exec_sql', {
        sql: "SELECT * FROM pg_policies WHERE tablename = 'news_rss_feeds'"
    });

    if (error) {
        console.error('Error running exec_sql:', error);
    } else {
        console.log('Policies:', JSON.stringify(data, null, 2));
    }
}

checkPolicies();
