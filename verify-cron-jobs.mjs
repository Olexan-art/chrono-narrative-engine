import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Перевірка крон джобів для source scoring\n');

// Get cron jobs
const { data: cronJobs, error } = await supabase
  .rpc('pg_catalog.pg_stat_user_functions')
  .select('*');

// Alternative: query cron.job table directly
const cronQuery = `
  SELECT 
    jobname,
    schedule,
    active,
    command
  FROM cron.job
  WHERE jobname LIKE '%scoring%'
  ORDER BY jobname;
`;

console.log('📋 SQL запит для перевірки в Supabase Dashboard:');
console.log('─'.repeat(60));
console.log(cronQuery);
console.log('─'.repeat(60));

// Check recent scorings with timestamps
const { data: recentScorings, error: scoringError } = await supabase
  .from('news_rss_items')
  .select('id, title, source_scoring_at, source_scoring')
  .not('source_scoring', 'is', null)
  .order('source_scoring_at', { ascending: false, nullsFirst: false })
  .limit(10);

console.log('\n📊 Останні 10 скорингів з timestamp:');
if (recentScorings && recentScorings.length > 0) {
  recentScorings.forEach((item, i) => {
    const date = item.source_scoring_at ? new Date(item.source_scoring_at) : null;
    const dateStr = date ? date.toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }) : 'НЕ ВСТАНОВЛЕНО';
    const provider = item.source_scoring?.provider || item.source_scoring?.json?.provider || 'unknown';
    console.log(`   ${i + 1}. ${dateStr} [${provider}] - ${item.title?.substring(0, 50)}...`);
  });
} else {
  console.log('   Немає даних');
}

// Count by provider
const { data: providerCounts } = await supabase
  .from('news_rss_items')
  .select('source_scoring')
  .not('source_scoring', 'is', null)
  .not('source_scoring_at', 'is', null);

console.log('\n📈 Розподіл за провайдерами (з timestamp):');
const providers = {};
providerCounts?.forEach(item => {
  const provider = item.source_scoring?.provider || 'unknown';
  providers[provider] = (providers[provider] || 0) + 1;
});

Object.entries(providers).forEach(([provider, count]) => {
  console.log(`   ${provider}: ${count}`);
});

console.log('\n⏰ Наступні запуски:');
const now = new Date();
const minutes = now.getMinutes();
const hours = now.getHours();

const nextZAI = minutes < 30 ? `${hours}:30` : `${hours + 1}:00`;
const nextGemini = `${hours + 1}:15`;
const nextOpenAI = hours % 3 === 0 && minutes < 5 ? `${hours}:00` : `${hours + (3 - hours % 3)}:00`;

console.log(`   Z.AI (30хв): наступний о ${nextZAI}`);
console.log(`   Gemini (1год): наступний о ${nextGemini}`);
console.log(`   OpenAI (3год): наступний о ${nextOpenAI}`);

console.log('\n✅ Для перевірки активних кронів виконайте SQL запит вище в Supabase Dashboard → SQL Editor');
