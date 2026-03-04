// Тест DeepSeek після виправлень
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDeepSeekFixed() {
    console.log('🔍 Тестування виправленої DeepSeek функції...');

    try {
        // Спочатку перевіряємо налаштування
        console.log('\n1. Перевіряємо API ключі...');
        const { data: apiKeysData, error: apiError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'getApiKeys',
                password: '123'
            })
        });
        
        if (apiError) {
            console.error('❌ Помилка отримання API ключів:', apiError);
            return;
        }
        
        console.log('API ключі статус:', apiKeysData?.availability || 'Недоступно');

        // Тест DeepSeek функції
        console.log('\n2. Викликаємо bulk-retell-news-deepseek...');
        const { data, error } = await supabase.functions.invoke('bulk-retell-news-deepseek', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                llm_model: 'deepseek-chat',
                max_items: 2,
                job_name: 'test_deepseek_fixed',
                trigger: 'manual'
            })
        });

        if (error) {
            console.error('❌ Помилка виклику DeepSeek:', error);
            return;
        }

        console.log('\n✅ Результат DeepSeek функції:');
        console.log(`📊 Оброблено: ${data.processed}`);
        console.log(`✅ Успішно: ${data.success_count || data.success || 'N/A'}`);
        console.log(`❌ Помилок: ${data.error_count || data.failed || 0}`);
        if (data.errors?.length > 0) {
            console.log('❌ Деталі помилок:', data.errors.slice(0, 2));
        }

        // Перевіряємо статистику
        console.log('\n3. Перевіряємо статистику (останні 2г)...');
        const { data: statsData, error: statsError } = await supabase.functions.invoke('admin', {
            body: JSON.stringify({
                action: 'getRetellStats',
                password: '123',
                data: { hours: 2 }
            })
        });

        if (statsError) {
            console.error('❌ Помилка отримання статистики:', statsError);
            return;
        }

        console.log('\n📈 Статистика за останні 2 години:');
        const stats = statsData?.rows || [];
        stats.forEach(stat => {
            console.log(`${stat.provider} (${stat.model}): ${stat.news_retold} переказів`);
        });

    } catch (e) {
        console.error('❌ Критична помилка:', e.message);
    }
}

testDeepSeekFixed();