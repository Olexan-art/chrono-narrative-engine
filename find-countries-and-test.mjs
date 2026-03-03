import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tuledxqigzufkecztnlo.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
);

(async () => {
  console.log('🔍 Пошук країн та запуск RSS процесів...\n');

  // 1. Знайти всі країни
  console.log('🌍 Країни в базі:');
  const { data: countries, error: countriesError } = await supabase
    .from('news_countries')
    .select('id, code, name, is_active')
    .order('name');

  if (countriesError) {
    console.log('❌ Помилка:', countriesError.message);
  } else {
    countries?.forEach((country, i) => {
      const status = country.is_active ? '🟢' : '🔴';
      console.log(`   ${i + 1}. ${status} [${country.code}] ${country.name} (${country.id})`);
    });
  }

  // 2. Спробуємо запустити fetch з правильним UUID
  const usCountry = countries?.find(c => c.code?.toLowerCase() === 'us');
  if (usCountry) {
    console.log(`\n🚀 Запускаємо RSS fetch для США (${usCountry.id})...`);
    
    try {
      const response = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/fetch-rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
        },
        body: JSON.stringify({
          action: 'fetch_country',
          countryId: usCountry.id,
          limit: 5
        })
      });

      const result = await response.text();
      console.log(`   📊 Статус: ${response.status}`);
      console.log(`   📝 Результат: ${result.substring(0, 300)}...`);
    } catch (e) {
      console.log(`   ⚠️ Помилка: ${e.message}`);
    }
  } else {
    console.log('\n❌ Країна USA не знайдена!');
  }

  // 3. Спробуємо process_pending
  console.log('\n🔄 Запускаємо process_pending...');
  try {
    const response = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/fetch-rss', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
      },
      body: JSON.stringify({
        action: 'process_pending',
        limit: 3
      })
    });

    const result = await response.text();
    console.log(`   📊 Статус: ${response.status}`);
    console.log(`   📝 Результат: ${result.substring(0, 300)}...`);
  } catch (e) {
    console.log(`   ⚠️ Помилка: ${e.message}`);
  }

  console.log('\n✅ Тестування завершено!');
  process.exit(0);
})();