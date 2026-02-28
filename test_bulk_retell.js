async function testBulkRetell() {
    const url = 'https://tuledxqigzufkecztnlo.supabase.co/functions/v1/bulk-retell-news';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

    const payload = {
        country_code: 'US',
        time_range: 'last_1h',
        force_all: false,
        trigger: 'manual'
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Response:", data);
    } catch (err) {
        console.error("Error:", err);
    }
}

testBulkRetell();
