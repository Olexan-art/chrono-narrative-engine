import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

(async () => {
  console.log('🧪 Тестування RSS та фетч функцій...\n');

  // Тест 1: fetch-rss функція
  console.log('1️⃣ Тестування fetch-rss:');
  const testCases = [
    { action: 'get_status', desc: 'Статус' },
    { action: 'single_country', country_code: 'us', desc: 'US новини' },
    { action: 'get_cron_stats', desc: 'Cron статистики' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`   📡 ${testCase.desc}...`);
      const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(testCase)
      });

      const result = await response.text();
      
      if (response.ok) {
        console.log(`   ✅ ${testCase.desc}: OK (${result.length} symbols)`);
        if (result.length < 500) {
          console.log(`      Відповідь: ${result}`);
        }
      } else {
        console.log(`   ❌ ${testCase.desc}: Error ${response.status}`);
        console.log(`      Відповідь: ${result.substring(0, 200)}...`);
      }
    } catch (e) {
      console.log(`   ⚠️ ${testCase.desc}: Exception: ${e.message}`);
    }
    
    // Пауза між запитами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Тест 2: Перевірити останні новини простим запитом
  console.log('\n2️⃣ Останні 5 новин (прямий запит):');
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: latestNews, error } = await supabase
      .from('news_rss_items')
      .select('id, title, created_at, country:news_countries(code)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log('   ❌ Помилка:', error.message);
    } else if (latestNews?.length > 0) {
      latestNews.forEach((news, i) => {
        const time = new Date(news.created_at).toLocaleString('uk-UA');
        const country = news.country?.code || '?';
        console.log(`   ${i + 1}. [${country}] ${news.title.substring(0, 50)}... (${time})`);
      });
    } else {
      console.log('   📝 Новини не знайдені');
    }
  } catch (e) {
    console.log(`   ⚠️ Exception: ${e.message}`);
  }

  // Тест 3: Спробувати запустити RSS односторонній fetch
  console.log('\n3️⃣ Ручний запуск RSS фетчу:');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'single_country',
        country_code: 'us',
        process_limit: 5,
        auto_retell: false
      })
    });

    const result = await response.text();
    console.log(`   📊 Статус: ${response.status}`);
    console.log(`   📝 Результат: ${result.substring(0, 300)}...`);
  } catch (e) {
    console.log(`   ⚠️ Exception: ${e.message}`);
  }

  console.log('\nℹ️ Рекомендації:');
  console.log('   - Cron джоби потрібно налаштувати в Supabase Dashboard');
  console.log('   - RSS фіди працюють, але потребують автоматичного запуску');
  console.log('   - Розглянь використання GitHub Actions для cron джобів');

  process.exit(0);
})();