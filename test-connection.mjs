import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== Testing Supabase Connection ===\n');

// Test 1: Count all news items
console.log('1. Total news items:');
const { count: totalCount, error: totalError } = await supabase
  .from('news_rss_items')
  .select('*', { count: 'exact', head: true });

if (totalError) {
  console.log('   ERROR:', totalError.message);
} else {
  console.log('   Count:', totalCount);
}

// Test 2: Count news with source_scoring
console.log('\n2. News with source_scoring:');
const { count: scoringCount, error: scoringError } = await supabase
  .from('news_rss_items')
  .select('*', { count: 'exact', head: true })
  .not('source_scoring', 'is', null);

if (scoringError) {
  console.log('   ERROR:', scoringError.message);
} else {
  console.log('   Count:', scoringCount);
}

// Test 3: Get one news item with all fields
console.log('\n3. Sample news item:');
const { data: sampleData, error: sampleError } = await supabase
  .from('news_rss_items')
  .select('id, title, source_scoring, source_scoring_at, published_at')
  .limit(1)
  .single();

if (sampleError) {
  console.log('   ERROR:', sampleError.message);
} else {
  console.log('   ID:', sampleData?.id);
  console.log('   Title:', sampleData?.title?.substring(0, 50));
  console.log('   Published:', sampleData?.published_at);
  console.log('   Scoring:', sampleData?.source_scoring);
  console.log('   Scoring At:', sampleData?.source_scoring_at);
}

// Test 4: Check if source_scoring_at field exists
console.log('\n4. Recent items with scoring:');
const { data: recentData, error: recentError } = await supabase
  .from('news_rss_items')
  .select('id, source_scoring, source_scoring_at')
  .not('source_scoring', 'is', null)
  .order('id', { ascending: false })
  .limit(5);

if (recentError) {
  console.log('   ERROR:', recentError.message);
} else {
  console.log('   Found:', recentData?.length, 'items');
  recentData?.forEach((item, i) => {
    console.log(`   ${i + 1}. ID ${item.id}: scoring=${item.source_scoring}, scoring_at=${item.source_scoring_at}`);
  });
}
