import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    console.log('🔍 Тестуємо основні API endpoints...\n');

    // Тест 1: Новини
    console.log('📰 Тестуємо завантаження новин...');
    const newsPromise = supabase
      .from('news')
      .select('id,title,created_at')
      .limit(3);

    const newsTimeout = setTimeout(() => {
      console.log('⏱️ Новини: TIMEOUT (>5 секунд)');
    }, 5000);

    const { data: news, error: newsError } = await newsPromise;
    clearTimeout(newsTimeout);

    if (newsError) {
      console.log('❌ Новини:', newsError.message);
    } else {
      console.log(`✅ Новини: ${news?.length || 0} записів`);
    }

    // Тест 2: Wiki entities
    console.log('📚 Тестуємо завантаження wiki...');
    const wikiPromise = supabase
      .from('wiki_entities')
      .select('id,title,created_at')
      .limit(3);

    const wikiTimeout = setTimeout(() => {
      console.log('⏱️ Wiki: TIMEOUT (>5 секунд)');
    }, 5000);

    const { data: wiki, error: wikiError } = await wikiPromise;
    clearTimeout(wikiTimeout);

    if (wikiError) {
      console.log('❌ Wiki:', wikiError.message);
    } else {
      console.log(`✅ Wiki: ${wiki?.length || 0} записів`);
    }

    // Тест 3: Countries
    console.log('🌍 Тестуємо завантаження країн...');
    const countriesPromise = supabase
      .from('countries')
      .select('*')
      .limit(5);

    const countriesTimeout = setTimeout(() => {
      console.log('⏱️ Країни: TIMEOUT (>5 секунд)');
    }, 5000);

    const { data: countries, error: countriesError } = await countriesPromise;
    clearTimeout(countriesTimeout);

    if (countriesError) {
      console.log('❌ Країни:', countriesError.message);
    } else {
      console.log(`✅ Країни: ${countries?.length || 0} записів`);
    }

  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
  }
  
  console.log('\n🏁 Тест завершено');
  process.exit(0);
})();