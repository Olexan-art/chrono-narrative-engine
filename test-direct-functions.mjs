// Простий тест edge функцій без admin
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDirectEdgeFunctions() {
    console.log('🧪 Прямий тест edge функцій...');

    try {
        console.log('\n📞 Тест Z.AI функції...');
        const { data: zaiData, error: zaiError } = await supabase.functions.invoke('bulk-retell-news-zai', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                max_items: 1,
                job_name: 'test_direct_zai',
                trigger: 'manual'
            })
        });

        if (zaiError) {
            console.log('❌ Z.AI не працює:', zaiError.message);
        } else {
            console.log('✅ Z.AI працює:');
            console.log('   ▶️ processed:', zaiData?.processed || 0);
            console.log('   ✅ success_count:', zaiData?.success_count || 0);
            console.log('   ❌ error_count:', zaiData?.error_count || 0);
            
            if (zaiData?.success_count > 0) {
                console.log('🎯 Z.AI успішно обробляє новини!');
            }
        }

        // Пауза перед наступним тестом
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n📞 Тест DeepSeek функції...');
        const { data: deepseekData, error: deepseekError } = await supabase.functions.invoke('bulk-retell-news-deepseek', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                max_items: 1,
                job_name: 'test_direct_deepseek',
                trigger: 'manual'
            })
        });

        if (deepseekError) {
            console.log('❌ DeepSeek не працює:', deepseekError.message);
        } else {
            console.log('✅ DeepSeek працює:');
            console.log('   ▶️ processed:', deepseekData?.processed || 0);
            console.log('   ✅ success_count:', deepseekData?.success_count || 0);
            console.log('   ❌ error_count:', deepseekData?.error_count || 0);
            
            if (deepseekData?.error) {
                console.log('   🔴 Error:', deepseekData.error);
            }
            
            if (deepseekData?.success_count > 0) {
                console.log('🎯 DeepSeek успішно обробляє новини!');
            }
        }

        console.log('\n📊 Висновок:');
        const zaiWorks = zaiData && !zaiError;
        const deepSeekWorks = deepseekData && !deepseekError;

        if (zaiWorks && deepSeekWorks) {
            console.log('✅ Обидві функції працюють');
            console.log('❓ Проблема може бути в автоматичних cron job або статистиці');
        } else if (zaiWorks) {
            console.log('⚠️  Тільки Z.AI працює, DeepSeek має проблеми');
        } else if (deepSeekWorks) {
            console.log('⚠️  Тільки DeepSeek працює, Z.AI має проблеми');
        } else {
            console.log('❌ Обидві функції мають проблеми');
        }

    } catch (e) {
        console.error('💥 Критична помилка:', e.message);
    }
}

testDirectEdgeFunctions();