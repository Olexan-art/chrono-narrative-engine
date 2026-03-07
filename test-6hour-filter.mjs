import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 Перевірка фільтру 3 годин для скорингу\n');

const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const now = new Date().toISOString();

console.log(`⏰ Поточний час: ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })}`);
console.log(`⏰ 3 години тому: ${new Date(threeHoursAgo).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })}\n`);

// Без фільтру часу (всі новини)
const { count: allCount } = await supabase
  .from('news_rss_items')
  .select('*', { count: 'exact', head: true })
  .not('content', 'is', null)
  .not('news_analysis', 'is', null)
  .is('source_scoring', null);

console.log(`📰 Всього новин готових до скорингу (без фільтру часу): ${allCount}`);

// З фільтром 3 годин
const { count: recentCount, data: recentNews } = await supabase
  .from('news_rss_items')
  .select('id, title, published_at, llm_processed_at', { count: 'exact' })
  .not('content', 'is', null)
  .not('news_analysis', 'is', null)
  .is('source_scoring', null)
  .gte('published_at', threeHoursAgo)
  .order('llm_processed_at', { ascending: false })
  .limit(10);

console.log(`📰 Новин для скорингу (останні 3 години): ${recentCount}\n`);

if (recentNews && recentNews.length > 0) {
  console.log('📋 Топ-10 кандидатів для скорингу:');
  recentNews.forEach((item, i) => {
    const published = new Date(item.published_at);
    const processed = item.llm_processed_at ? new Date(item.llm_processed_at) : null;
    const hoursAgo = Math.round((Date.now() - published.getTime()) / (1000 * 60 * 60) * 10) / 10;
    
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      📅 Опубліковано: ${hoursAgo}h тому`);
    console.log(`      🤖 Оброблено: ${processed ? processed.toLocaleString('uk-UA') : 'N/A'}`);
  });
} else {
  console.log('⚠️  Немає новин за останні 3 години для скорингу');
  console.log('\nМожливі причини:');
  console.log('  - Всі свіжі новини вже мають скоринг');
  console.log('  - Deep Analyst ще не обробив нові новини');
  console.log('  - RSS не отримав нові новини за останні 3 години');
}

// Перевірка розподілу за часом
console.log('\n📊 Розподіл новин для скорингу за часом:');

const ranges = [
  { label: '0-1 год', hours: 1 },
  { label: '1-3 год', hours: 3 },
  { label: '3-6 год', hours: 6 },
  { label: '6-12 год', hours: 12 },
  { label: '12-24 год', hours: 24 },
  { label: '>24 год', hours: 999 }
];

for (let i = 0; i < ranges.length; i++) {
  const prevHours = i > 0 ? ranges[i-1].hours : 0;
  const currentHours = ranges[i].hours;
  
  const startTime = new Date(Date.now() - currentHours * 60 * 60 * 1000).toISOString();
  const endTime = i > 0 ? new Date(Date.now() - prevHours * 60 * 60 * 1000).toISOString() : now;
  
  let query = supabase
    .from('news_rss_items')
    .select('*', { count: 'exact', head: true })
    .not('content', 'is', null)
    .not('news_analysis', 'is', null)
    .is('source_scoring', null);
  
  if (currentHours < 999) {
    query = query.gte('published_at', startTime);
  }
  if (i > 0) {
    query = query.lt('published_at', endTime);
  }
  
  const { count } = await query;
  
  console.log(`   ${ranges[i].label}: ${count || 0}`);
}

console.log('\n✅ Тепер крон джоби будуть обирати тільки новини опубліковані за останні 3 години');
