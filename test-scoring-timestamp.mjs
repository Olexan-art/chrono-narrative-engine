import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('📊 Перевірка source_scoring_at field\n');

// Check if column exists and has data
const { data, error } = await supabase
  .from('news_rss_items')
  .select('id, title, source_scoring, source_scoring_at, llm_processed_at')
  .not('source_scoring', 'is', null)
  .order('source_scoring_at', { ascending: false, nullsFirst: false })
  .limit(5);

if (error) {
  console.error('❌ Помилка:', error.message);
  if (error.message.includes('source_scoring_at')) {
    console.log('\n⚠️  Колонка source_scoring_at ще не існує!');
    console.log('Потрібно застосувати міграцію в Supabase Dashboard:\n');
    console.log('ALTER TABLE public.news_rss_items');
    console.log('ADD COLUMN IF NOT EXISTS source_scoring_at TIMESTAMP WITH TIME ZONE;');
  }
  process.exit(1);
}

console.log(`✅ Знайдено ${data?.length || 0} записів зі скорінгом\n`);

if (data && data.length > 0) {
  data.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title.substring(0, 60)}...`);
    console.log(`   📰 LLM processed: ${item.llm_processed_at ? new Date(item.llm_processed_at).toLocaleString('uk-UA') : 'N/A'}`);
    console.log(`   ⭐ Scoring at: ${item.source_scoring_at ? new Date(item.source_scoring_at).toLocaleString('uk-UA') : '❌ NULL (потрібно оновити)'}`);
    console.log('');
  });

  const withTimestamp = data.filter(d => d.source_scoring_at !== null).length;
  const withoutTimestamp = data.length - withTimestamp;

  console.log(`\n📈 Статистика:`);
  console.log(`   ✅ З source_scoring_at: ${withTimestamp}`);
  console.log(`   ❌ Без source_scoring_at: ${withoutTimestamp}`);

  if (withoutTimestamp > 0) {
    console.log(`\n⚠️  ${withoutTimestamp} записів мають скорінг, але без timestamp`);
    console.log('   Це нормально для старих записів. Нові будуть з timestamp.');
  }
} else {
  console.log('ℹ️  Немає записів зі скорінгом для перевірки');
}
