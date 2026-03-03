import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tuledxqigzufkecztnlo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
);

(async () => {
  try {
    console.log('🔍 Аналіз RSS та News процесів...\n');

    // 1. Перевірити структуру RSS фідів
    console.log('📊 RSS Feeds (топ-10):');
    const { data: rssFeeds, error: feedsError } = await supabase
      .from('news_rss_feeds')
      .select('id, name, url, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (feedsError) {
      console.log('❌ Помилка:', feedsError.message);
    } else {
      rssFeeds?.forEach((feed, i) => {
        const status = feed.is_active ? '🟢' : '🔴';
        console.log(`   ${i + 1}. ${status} ${feed.name}`);
        console.log(`      URL: ${feed.url}`);
      });
    }

    // 2. Перевірити країни з RSS новинами
    console.log('\n🌍 Countries з RSS новинами:');
    const { data: countriesWithNews, error: countriesError } = await supabase
      .from('news_countries')
      .select(`
        id, code, name, flag, is_active,
        news_rss_items(count)
      `)
      .eq('is_active', true);

    if (countriesError) {
      console.log('❌ Помилка:', countriesError.message);
    } else {
      countriesWithNews?.forEach((country, i) => {
        const newsCount = Array.isArray(country.news_rss_items) ? country.news_rss_items.length : 'unknown';
        console.log(`   ${i + 1}. [${country.code}] ${country.name} - ${newsCount} новин`);
      });
    }

    // 3. Перевірити останні добавлені новини по годинах
    console.log('\n⏰ Розподіл новин за останні 24 години:');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: hourlyStats, error: hourlyError } = await supabase
      .from('news_rss_items')
      .select('created_at')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false });

    if (hourlyError) {
      console.log('❌ Помилка:', hourlyError.message);
    } else if (hourlyStats?.length > 0) {
      const hourCounts = new Map();
      hourlyStats.forEach(item => {
        const hour = new Date(item.created_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      console.log(`   📈 Всього новин за 24 години: ${hourlyStats.length}`);
      console.log('   📊 Розподіл по годинах:');
      
      for (let hour = 0; hour < 24; hour++) {
        const count = hourCounts.get(hour) || 0;
        if (count > 0) {
          const bar = '█'.repeat(Math.min(count / 2, 20));
          console.log(`     ${hour.toString().padStart(2, '0')}:00 - ${count.toString().padStart(3)} новин ${bar}`);
        }
      }
    } else {
      console.log('   ⚠️ Немає новин за останні 24 години!');
    }

    // 4. Тестувати RSS fetch функцію
    console.log('\n🧪 Тестування RSS fetch функції:');
    try {
      const response = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/fetch-rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0`
        },
        body: JSON.stringify({ action: 'get_status' })
      });

      if (response.ok) {
        const result = await response.text();
        console.log('   ✅ fetch-rss доступна, відповідь:', result.substring(0, 100) + '...');
      } else {
        console.log('   ❌ fetch-rss недоступна, статус:', response.status);
      }
    } catch (e) {
      console.log('   ⚠️ Помилка тестування RSS fetch:', e.message);
    }

    console.log('\n✅ Діагностика завершена!');
  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
  }
  
  process.exit(0);
})();