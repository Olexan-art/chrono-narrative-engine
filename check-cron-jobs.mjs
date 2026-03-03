import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tuledxqigzufkecztnlo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0'
);

(async () => {
  try {
    console.log('📊 Перевірка cron джобів та RSS процесів...\n');

    // 1. Перевірити конфігурації cron джобів
    console.log('🔧 Cron Job Configurations:');
    const { data: cronConfigs, error: configError } = await supabase
      .from('cron_job_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (configError) {
      console.log('❌ Помилка отримання cron configs:', configError.message);
    } else if (cronConfigs?.length > 0) {
      cronConfigs.forEach((config, i) => {
        console.log(`   ${i + 1}. [${config.job_name}]`);
        console.log(`      ├─ Enabled: ${config.is_enabled ? '✅' : '❌'}`);
        console.log(`      ├─ Schedule: ${config.schedule || 'не встановлено'}`);
        console.log(`      ├─ Last run: ${config.last_run_at ? new Date(config.last_run_at).toLocaleString('uk-UA') : 'ніколи'}`);
        console.log(`      └─ Next run: ${config.next_run_at ? new Date(config.next_run_at).toLocaleString('uk-UA') : 'не заплановано'}`);
      });
    } else {
      console.log('   📝 Немає налаштованих cron джобів');
    }

    // 2. Статистики останніх запусків
    console.log('\n📈 Cron Job Statistics (останні 24 години):');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cronStats, error: statsError } = await supabase
      .from('cron_stats')
      .select('*')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(10);

    if (statsError) {
      console.log('❌ Помилка отримання cron stats:', statsError.message);
    } else if (cronStats?.length > 0) {
      cronStats.forEach((stat, i) => {
        const time = new Date(stat.created_at).toLocaleString('uk-UA');
        const status = stat.success ? '✅' : '❌';
        console.log(`   ${i + 1}. [${stat.cron_name}] ${status} - ${time}`);
        console.log(`      Час виконання: ${stat.duration_ms}ms, Записів: ${stat.records_processed || 0}`);
        if (!stat.success && stat.error_message) {
          console.log(`      ⚠️ Помилка: ${stat.error_message.substring(0, 100)}...`);
        }
      });
    } else {
      console.log('   📝 Немає запусків за останні 24 години');
    }

    // 3. Перевірити новини RSS за останній час
    console.log('\n📰 RSS News Activity (останні 6 годин):');
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNews, error: newsError } = await supabase
      .from('news_rss_items')
      .select('id, title, created_at, country:news_countries(code, name), news_rss_feeds(name)')
      .gte('created_at', sixHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (newsError) {
      console.log('❌ Помилка отримання новин RSS:', newsError.message);
    } else if (recentNews?.length > 0) {
      console.log(`   ✅ Знайдено ${recentNews.length} нових RSS записів:`);
      recentNews.forEach((news, i) => {
        const time = new Date(news.created_at).toLocaleString('uk-UA');
        const country = news.country?.code || 'unknown';
        const source = news.news_rss_feeds?.name || 'unknown source';
        console.log(`   ${i + 1}. [${country}] ${news.title.substring(0, 60)}... (${source}) - ${time}`);
      });
    } else {
      console.log('   ⚠️ Немає нових RSS записів за останні 6 годин!');
    }

    // 4. Загальна статистика RSS фідів
    console.log('\n📊 RSS Feed Summary:');
    const { data: rssFeedStats, error: feedStatsError } = await supabase
      .from('news_rss_feeds')
      .select('id, name, url, is_active, last_sync_at, fetch_count, error_count')
      .order('last_sync_at', { ascending: false });

    if (feedStatsError) {
      console.log('❌ Помилка отримання RSS фідів:', feedStatsError.message);
    } else if (rssFeedStats?.length > 0) {
      const activeFeedsCount = rssFeedStats.filter(f => f.is_active).length;
      const recentSyncCount = rssFeedStats.filter(f => {
        if (!f.last_sync_at) return false;
        const lastSync = new Date(f.last_sync_at);
        const sixHours = Date.now() - 6 * 60 * 60 * 1000;
        return lastSync.getTime() > sixHours;
      }).length;

      console.log(`   📈 Всього RSS фідів: ${rssFeedStats.length}`);
      console.log(`   ✅ Активні фіди: ${activeFeedsCount}`);
      console.log(`   🔄 Синхронізовані за 6 год: ${recentSyncCount}`);
      
      console.log('\n   Топ-5 найактивніших фідів:');
      rssFeedStats.slice(0, 5).forEach((feed, i) => {
        const lastSync = feed.last_sync_at 
          ? new Date(feed.last_sync_at).toLocaleString('uk-UA')
          : 'ніколи';
        const status = feed.is_active ? '🟢' : '🔴';
        console.log(`     ${i + 1}. ${status} ${feed.name} (${feed.fetch_count || 0} синхронізацій)`);
        console.log(`        Остання синхронізація: ${lastSync}`);
      });
    }

    console.log('\n✅ Аналіз завершено!');
  } catch (err) {
    console.error('❌ Критична помилка:', err.message);
  }
  
  process.exit(0);
})();