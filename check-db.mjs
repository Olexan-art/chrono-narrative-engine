import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

console.log('🔍 Перевірка підключення до Supabase...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

(async () => {
  try {
    console.log('📡 Запит до таблиці settings...');
    const response = await supabase.from('settings').select('*').limit(1);
    
    if (response.error) {
      console.error('❌ Помилка:', response.error.message);
    } else {
      console.log('✅ Успішно! Записів:', response.data?.length || 0);
      console.log('✨ База даних доступна і працює!');
    }
  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
  }
  process.exit(0);
})();
