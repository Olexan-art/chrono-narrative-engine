import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRetoldFilter() {
  console.log('🔍 Перевірка фільтру переказу (content) для source scoring\n');
  
  // Той самий запит, що використовує Edge Function в auto_select режимі
  const { data, error } = await supabase
    .from('news_rss_items')
    .select('id, title, slug, content, news_analysis, source_scoring, llm_processed_at, published_at, key_points')
    .not('content', 'is', null)
    .not('news_analysis', 'is', null)
    .is('source_scoring', null)
    .order('llm_processed_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Помилка запиту:', error);
    return;
  }

  console.log(`✅ Знайдено ${data.length} новин готових до оцінювання\n`);

  if (data.length === 0) {
    console.log('⚠️  Немає новин з повним переказом (content + news_analysis) та без оцінки\n');
    
    // Перевіримо скільки новин є взагалі
    const { count: totalWithContent } = await supabase
      .from('news_rss_items')
      .select('*', { count: 'exact', head: true })
      .not('content', 'is', null);
    
    const { count: totalWithoutScoring } = await supabase
      .from('news_rss_items')
      .select('*', { count: 'exact', head: true })
      .is('source_scoring', null);
    
    console.log(`📊 Статистика:`);
    console.log(`   Новин з content (переказ): ${totalWithContent}`);
    console.log(`   Новин без source_scoring: ${totalWithoutScoring}`);
    
    return;
  }

  data.forEach((item, i) => {
    const hasContent = item.content !== null;
    const hasAnalysis = item.news_analysis !== null;
    const hasScoring = item.source_scoring !== null;
    const hasKeyPoints = item.key_points && item.key_points.length > 0;
    
    console.log(`${i + 1}. ${item.title.substring(0, 60)}...`);
    console.log(`   Slug: ${item.slug}`);
    console.log(`   Content (переказ): ${hasContent ? '✓' : '✗'}`);
    console.log(`   Key Points: ${hasKeyPoints ? `✓ (${item.key_points.length})` : '✗'}`);
    console.log(`   Analysis: ${hasAnalysis ? '✓' : '✗'}`);
    console.log(`   Scoring: ${hasScoring ? '✓' : '✗'}`);
    console.log(`   Published: ${item.published_at ? new Date(item.published_at).toLocaleString('uk-UA') : 'N/A'}`);
    console.log(`   LLM Processed: ${item.llm_processed_at ? new Date(item.llm_processed_at).toLocaleString('uk-UA') : 'N/A'}`);
    console.log();
  });

  console.log(`\n💡 Наступна новина для оцінювання буде: "${data[0].title.substring(0, 60)}..."`);
  console.log(`   ID: ${data[0].id}`);
  console.log(`   Published: ${data[0].published_at ? new Date(data[0].published_at).toLocaleString('uk-UA') : 'N/A'}`);
}

testRetoldFilter().catch(console.error);
