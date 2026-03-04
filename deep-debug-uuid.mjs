// Deep debug of Z.AI and UUID processing
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deepDebug() {
    console.log('🔍 Починаю глибоку діагностику UUID filtering...');

    try {
        // 1. Отримуємо кілька новин для тесту UUID
        const { data: items, error } = await supabase
            .from('news_rss_items')
            .select('id, title')
            .limit(10);
            
        if (error) throw error;

        console.log('\n🧪 Тест фільтрації UUID (аналогічно edge функціям):');
        items.forEach(item => {
            const uuid = item.id;
            // У наших функціях: parseInt(item.id.slice(-1), 16) % 2 === 0
            const lastChar = uuid.slice(-1);
            const parsed = parseInt(lastChar, 16);
            const isZai = parsed % 2 === 0;
            
            console.log(`ID: ${uuid} | Ост. символ: ${lastChar} | Число: ${parsed} | Провайдер: ${isZai ? 'Z.AI' : 'DeepSeek'}`);
        });

        // 2. Тестуємо Z.AI з логуванням RESPONSE
        console.log('\n📞 Тестуємо Z.AI з детальним логуванням...');
        const zaiResponse = await supabase.functions.invoke('bulk-retell-news-zai', {
            body: JSON.stringify({
                country_code: 'US',
                max_items: 2,
                trigger: 'manual'
            })
        });

        console.log('Z.AI статус:', zaiResponse.error ? '❌ ПОМИЛКА' : '✅ OK');
        if (zaiResponse.data) {
            console.log('Дані Z.AI:', JSON.stringify(zaiResponse.data, null, 2));
        } else if (zaiResponse.error) {
            console.log('Помилка Z.AI:', zaiResponse.error);
        }

        // 3. Тестуємо DeepSeek з детальним логуванням
        console.log('\n📞 Тестуємо DeepSeek з детальним логуванням...');
        const dsResponse = await supabase.functions.invoke('bulk-retell-news-deepseek', {
            body: JSON.stringify({
                country_code: 'US',
                max_items: 2,
                trigger: 'manual'
            })
        });

        console.log('DeepSeek статус:', dsResponse.error ? '❌ ПОМИЛКА' : '✅ OK');
        if (dsResponse.data) {
            console.log('Дані DeepSeek:', JSON.stringify(dsResponse.data, null, 2));
        } else if (dsResponse.error) {
            console.log('Помилка DeepSeek:', dsResponse.error);
        }

    } catch (e) {
        console.error('💥 Помилка:', e.message);
    }
}

deepDebug();