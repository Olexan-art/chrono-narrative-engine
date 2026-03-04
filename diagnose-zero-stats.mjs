// Діагностика статистики після деплою
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnosticsStats() {
    console.log('🔍 Діагностика статистики 0 переказів...');

    try {
        console.log('\n1. Перевіряємо черги в системі...');
        const { data: queueData, error: queueError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'getRetellQueueStats',
                password: '123'
            })
        });

        if (queueError) {
            console.error('❌ Помилка черги:', queueError.message);
            return;
        }

        console.log('📊 Черга:', queueData?.stats?.current_queue_size || 'N/A');

        console.log('\n2. Тестуємо ручну обробку Z.AI...');
        const { data: zaiData, error: zaiError } = await supabase.functions.invoke('bulk-retell-news-zai', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                max_items: 1,
                job_name: 'test_zai_manual',
                trigger: 'manual'
            })
        });

        if (zaiError) {
            console.error('❌ Z.AI помилка:', zaiError.message);
        } else {
            console.log('✅ Z.AI результат:');
            console.log(`   processed: ${zaiData.processed}`);
            console.log(`   success_count: ${zaiData.success_count}`);
            console.log(`   error_count: ${zaiData.error_count}`);
        }

        console.log('\n3. Тестуємо ручну обробку DeepSeek...');
        const { data: deepseekData, error: deepseekError } = await supabase.functions.invoke('bulk-retell-news-deepseek', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                max_items: 1,
                job_name: 'test_deepseek_manual',
                trigger: 'manual'
            })
        });

        if (deepseekError) {
            console.error('❌ DeepSeek помилка:', deepseekError.message);
        } else {
            console.log('✅ DeepSeek результат:');
            console.log(`   processed: ${deepseekData.processed}`);
            console.log(`   success_count: ${deepseekData.success_count}`);
            console.log(`   error_count: ${deepseekData.error_count}`);
            if (deepseekData.error) {
                console.log(`   error: ${deepseekData.error}`);
            }
        }

        console.log('\n4. Перевіряємо статистику після тестів...');
        const { data: statsData, error: statsError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'getRetellStats',
                password: '123',
                data: { hours: 1 }
            })
        });

        if (statsError) {
            console.error('❌ Статистика помилка:', statsError.message);
        } else {
            console.log('📈 Статистика за останню годину:');
            const stats = statsData?.rows || [];
            if (stats.length === 0) {
                console.log('   📊 Немає записів статистики');
            } else {
                stats.forEach(stat => {
                    console.log(`   ${stat.provider}: ${stat.news_retold} переказів (${stat.model})`);
                });
            }
        }

    } catch (e) {
        console.error('❌ Критична помилка діагностики:', e.message);
    }
}

diagnosticsStats();