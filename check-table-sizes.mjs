import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  console.log('🔢 Перевіряємо кількість записів...\n');

  // Швидкий запит для підрахунку
  try {
    console.log('📊 Рахуємо новини...');
    const { count: newsCount, error: newsCountError } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true });
    
    if (newsCountError) {
      console.log('❌ Помилка підрахунку новин:', newsCountError.message);
    } else {
      console.log(`📰 Всього новин: ${newsCount?.toLocaleString()}`);
    }

    console.log('📊 Рахуємо wiki...');
    const { count: wikiCount, error: wikiCountError } = await supabase
      .from('wiki_entities')
      .select('*', { count: 'exact', head: true });
    
    if (wikiCountError) {
      console.log('❌ Помилка підрахунку wiki:', wikiCountError.message);
    } else {
      console.log(`📚 Всього wiki: ${wikiCount?.toLocaleString()}`);
    }

    // Перевірка останніх оновлень
    console.log('\n🕒 Перевіряємо останні оновлення...');
    const { data: latestNews, error: latestError } = await supabase
      .from('news')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (latestError) {
      console.log('❌ Не вдалося отримати останні новини:', latestError.message);
    } else if (latestNews && latestNews.length > 0) {
      const lastUpdate = new Date(latestNews[0].created_at);
      const now = new Date();
      const hours = Math.floor((now - lastUpdate) / (1000 * 60 * 60));
      console.log(`📅 Останні новини: ${lastUpdate.toLocaleString()} (${hours} год тому)`);
    }

  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
  }
  
  process.exit(0);
})();