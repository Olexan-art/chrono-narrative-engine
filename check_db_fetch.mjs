const url = "https://tuledxqigzufkecztnlo.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0";

async function check() {
    const reqUrl = `${url}/rest/v1/news_rss_items?select=id,title,source_scoring&source_scoring=not.is.null&limit=5`;
    const res = await fetch(reqUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    console.log(`Found ${data.length || 0} items with scoring`);
    if (data.length > 0) {
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
