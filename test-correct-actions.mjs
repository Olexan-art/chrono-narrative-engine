const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

(async () => {
  console.log('🚀 Тестування ПРАВИЛЬНИХ RSS actions...\n');

  const testActions = [
    { action: 'get_cron_stats', desc: '📊 Cron Statistics' },
    { action: 'get_pending_stats', desc: '⏳ Pending News Stats' },  
    { action: 'fetch_country', countryId: 'us', desc: '🇺🇸 Fetch US News' },
    { action: 'fetch_us_rss', desc: '🇺🇸 Fetch US RSS (dedicated)' }
  ];

  for (const test of testActions) {
    try {
      console.log(`${test.desc}...`);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(test)
      });

      const result = await response.text();
      
      if (response.ok) {
        console.log(`✅ OK (${result.length} chars)`);
        
        // Спробуємо парсити JSON відповідь
        try {
          const jsonResult = JSON.parse(result);
          if (jsonResult.success !== undefined) {
            console.log(`   Success: ${jsonResult.success}`);
            if (jsonResult.total_feeds) console.log(`   Total feeds: ${jsonResult.total_feeds}`);
            if (jsonResult.new_items) console.log(`   New items: ${jsonResult.new_items}`);
            if (jsonResult.updated_items) console.log(`   Updated items: ${jsonResult.updated_items}`);
            if (jsonResult.feeds_fetched) console.log(`   Feeds fetched: ${jsonResult.feeds_fetched}`);
          }
        } catch {
          console.log(`   Response preview: ${result.substring(0, 200)}...`);
        }
      } else {
        console.log(`❌ Error ${response.status}`);
        console.log(`   Error: ${result.substring(0, 200)}...`);
      }
      
      console.log(''); // Порожній рядок для відступу
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунди пауза
    } catch (error) {
      console.error(`⚠️ Exception: ${error.message}\n`);
    }
  }

  console.log('🔧 Рекомендації щодо налаштування cron:');
  console.log('   1. Використовуй action="fetch_us_rss" для збору US новин');
  console.log('   2. Використовуй action="process_pending" для обробки pending новин');
  console.log('   3. Налаштуй GitHub Actions для автоматичних викликів');
  console.log('   4. Або використовуй зовнішній cron сервіс (cron-job.org)');

  process.exit(0);
})();