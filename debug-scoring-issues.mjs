import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuledxqigzufkecztnlo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('=== Debugging Scoring Issues ===\n');

// 1. Check how many scorings have timestamp
const { data: allScorings } = await supabase
  .from('news_rss_items')
  .select('id, source_scoring_at')
  .not('source_scoring', 'is', null)
  .limit(100);

const withTimestamp = allScorings?.filter(s => s.source_scoring_at !== null).length || 0;
const withoutTimestamp = (allScorings?.length || 0) - withTimestamp;

console.log('1. Source Scoring Timestamps:');
console.log(`   Total with scoring: ${allScorings?.length || 0}`);
console.log(`   With timestamp: ${withTimestamp}`);
console.log(`   Without timestamp: ${withoutTimestamp}`);
console.log('');

// 2. Check recent scorings
const { data: recent } = await supabase
  .from('news_rss_items')
  .select('title, source_scoring_at, source_scoring')
  .not('source_scoring', 'is', null)
  .order('source_scoring_at', { ascending: false, nullsFirst: false })
  .limit(10);

console.log('2. Recent Scorings (last 10):');
if (recent && recent.length > 0) {
  recent.forEach((item, i) => {
    const shortTitle = item.title.substring(0, 50);
    if (item.source_scoring_at) {
      const date = new Date(item.source_scoring_at).toLocaleString('uk-UA');
      const model = item.source_scoring?.json?.model || 'unknown';
      console.log(`   ${i+1}. ${date} [${model}] - ${shortTitle}...`);
    } else {
      console.log(`   ${i+1}. NO TIMESTAMP - ${shortTitle}...`);
    }
  });
} else {
  console.log('   No scorings found');
}
console.log('');

// 3. Check if there are news ready for scoring
const { data: ready, count } = await supabase
  .from('news_rss_items')
  .select('id, title', { count: 'exact' })
  .not('content', 'is', null)
  .not('news_analysis', 'is', null)
  .is('source_scoring', null)
  .limit(5);

console.log('3. News Ready for Scoring:');
console.log(`   Count: ${count || 0}`);
if (ready && ready.length > 0) {
  ready.forEach((item, i) => {
    const shortTitle = item.title.substring(0, 50);
    console.log(`   ${i+1}. ${shortTitle}...`);
  });
}
console.log('');

// 4. Check today's scorings
const today = new Date().toISOString().split('T')[0];
const { data: todayScorings } = await supabase
  .from('news_rss_items')
  .select('id, title, source_scoring_at')
  .not('source_scoring', 'is', null)
  .gte('source_scoring_at', today)
  .order('source_scoring_at', { ascending: false });

console.log('4. Scorings Today:');
console.log(`   Count: ${todayScorings?.length || 0}`);
if (todayScorings && todayScorings.length > 0) {
  todayScorings.forEach((item, i) => {
    const date = new Date(item.source_scoring_at).toLocaleTimeString('uk-UA');
    const shortTitle = item.title.substring(0, 50);
    console.log(`   ${i+1}. ${date} - ${shortTitle}...`);
  });
}
console.log('');

console.log('=== Next Steps ===');
console.log('1. Check Netlify deploy: https://app.netlify.com/');
console.log('2. Run debug-scoring-cron.sql in Supabase Dashboard');
console.log('3. Check source scoring settings are enabled');
