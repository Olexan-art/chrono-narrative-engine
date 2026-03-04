// Прямий тест DeepSeek без admin
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDeepSeekDirect() {
    console.log('🔍 Прямий тест DeepSeek функції...');

    try {
        console.log('\n📞 Викликаємо bulk-retell-news-deepseek...');
        const { data, error } = await supabase.functions.invoke('bulk-retell-news-deepseek', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                llm_model: 'deepseek-chat',
                max_items: 1,
                job_name: 'test_deepseek_fix',
                trigger: 'manual'
            })
        });

        if (error) {
            console.error('❌ Помилка виклику DeepSeek:', error.message || error);
            console.error('Деталі помилки:', JSON.stringify(error, null, 2));
            return;
        }

        console.log(`\n✅ Результат DeepSeek:`, data);
        
        if (data.error) {
            if (data.error.includes('DEEPSEEK_API_KEY not configured')) {
                console.log('❌ DeepSeek API ключ все ще не налаштований');
            } else if (data.error.includes('HTTP 401')) {
                console.log('❌ DeepSeek API ключ неправильний або недійсний');
            } else {
                console.log('❌ Інша помилка DeepSeek:', data.error);
            }
        } else {
            console.log(`📊 Оброблено: ${data.processed || 0}`);
            console.log(`✅ Успішно: ${data.success_count || data.success || 0}`);
            console.log(`❌ Помилок: ${data.error_count || data.failed || 0}`);
        }

    } catch (e) {
        console.error('❌ Критична помилка:', e.message);
    }
}

testDeepSeekDirect();