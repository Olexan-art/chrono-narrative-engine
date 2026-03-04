// Production test після деплою виправлень
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProductionDeployment() {
    console.log('🚀 Тестування production після деплою...');

    try {
        // Тест обробки черги
        console.log('\n📊 Тестуємо обробку черги з новими виправленнями...');
        const { data: adminData, error: adminError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'processRetellQueue',
                password: '123',
                data: {
                    provider: 'both',
                    batch_size: 4,
                    timeout_minutes: 5
                }
            })
        });

        if (adminError) {
            console.error('❌ Admin помилка:', adminError.message);
            return;
        }

        if (!adminData?.success) {
            console.log('⚠️  Результат admin:', adminData);
            return;
        }

        const results = adminData.results;
        console.log('\n✅ Production обробка черги:');
        console.log(`🔵 Z.AI: ${results.zai.processed} оброблено, ${results.zai.success} успішно, ${results.zai.failed} помилок`);
        if (results.zai.error) {
            console.log(`   📛 Z.AI помилка: ${results.zai.error}`);
        }

        console.log(`🟣 DeepSeek: ${results.deepseek.processed} оброблено, ${results.deepseek.success} успішно, ${results.deepseek.failed} помилок`);
        if (results.deepseek.error) {
            console.log(`   📛 DeepSeek помилка: ${results.deepseek.error}`);
        }

        console.log(`⏱️  Загальний час: ${Math.round(results.total_time_ms / 1000)}с`);

        // Перевіряємо статистику
        console.log('\n📈 Статистика (останні 3 години):');
        const { data: statsData, error: statsError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'getRetellStats',
                password: '123',
                data: { hours: 3 }
            })
        });

        if (statsError) {
            console.error('❌ Статистика помилка:', statsError.message);
            return;
        }

        const stats = statsData?.rows || [];
        if (stats.length === 0) {
            console.log('📊 Немає даних статистики за останні 3 години');
        } else {
            stats.forEach(stat => {
                console.log(`   ${stat.provider} (${stat.model}): ${stat.news_retold} переказів`);
            });
        }

        console.log('\n🎯 Тест завершено!');

    } catch (e) {
        console.error('❌ Критична помилка тесту production:', e.message);
    }
}

testProductionDeployment();