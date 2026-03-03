async function testBulkRetellDeepseek() {
    const url = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news-deepseek';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    const payload = {
        country_code: 'US',
        time_range: 'last_1h',
        force_all: false,
        trigger: 'manual',
        llm_model: 'deepseek-chat'
    };

    try {
        console.log("Testing Deepseek Edge Function...");
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log(`Status: ${res.status} ${res.statusText}`);
        try {
            const data = JSON.parse(text);
            console.log("Response JSON:", JSON.stringify(data, null, 2));
        } catch (e) {
            console.log("Raw Response Text:", text);
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

testBulkRetellDeepseek();
