async function run() {
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    try {
        const url = `https://tuledxqigzufkecztnlo.supabase.co/rest/v1/llm_usage_logs?select=*&order=created_at.desc&limit=5`;
        const res = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
        const data = await res.json();
        console.log("Recent LLM usage logs:", data);
    } catch (e) { console.error(e) }
}
run();
