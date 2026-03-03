const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

async function testProcessPending() {
  console.log('🔄 Тестування process_pending...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'process_pending'
      })
    });

    console.log(`📊 Статус: ${response.status}`);
    const result = await response.text();
    console.log(`📝 Результат (перші 1000 символів):`);
    console.log(result.substring(0, 1000));
    
    if (response.status === 200) {
      try {
        const data = JSON.parse(result);
        console.log(`\n✅ Успіх: ${data.success}`);
        if (data.processed) console.log(`📰 Оброблено: ${data.processed} новин`);
        if (data.errors && data.errors.length > 0) {
          console.log(`❌ Помилки: ${data.errors.length}`);
        }
      } catch (e) {
        console.log(`❌ Помилка парсингу JSON: ${e.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Помилка: ${error.message}`);
  }
}

testProcessPending();