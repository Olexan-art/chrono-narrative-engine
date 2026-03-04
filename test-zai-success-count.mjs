// Тест Z.AI для перевірки виправлення success_count
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testZaiSuccessCount() {
    console.log('🔍 Тест Z.AI success_count виправлення...');

    try {
        console.log('\n📞 Викликаємо bulk-retell-news-zai...');
        const { data, error } = await supabase.functions.invoke('bulk-retell-news-zai', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                llm_model: 'GLM-4.7-Flash',
                max_items: 2,
                job_name: 'test_zai_success_count',
                trigger: 'manual'
            })
        });

        if (error) {
            console.error('❌ Помилка виклику Z.AI:', error.message);
            return;
        }

        console.log('\n✅ Z.AI повернула:');
        console.log('   processed:', data.processed);
        console.log('   success_count:', data.success_count);
        console.log('   error_count:', data.error_count);
        console.log('   success (old):', data.success);

        // Імітуємо admin логіку
        const mockResult = {
            zai: {
                processed: data.processed || 0,
                success: data.success_count || data.success || 0,
                failed: data.error_count || data.failed || 0, 
                error: null
            }
        };

        console.log('\n📊 Як це буде показуватись в admin панелі:');
        console.log(`   Оброблено: ${mockResult.zai.processed}`);
        console.log(`   Успішно: ${mockResult.zai.success}`);
        console.log(`   Помилок: ${mockResult.zai.failed}`);

    } catch (e) {
        console.error('❌ Критична помилка:', e.message);
    }
}

testZaiSuccessCount();