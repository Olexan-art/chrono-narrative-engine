// Deep debug of UUID partitioning logic
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deepDebug() {
    console.log('🔍 Починаю діагностику UUID partitioning...');

    try {
        // Отримуємо 100 новин для статистики
        const { data: items, error } = await supabase
            .from('news_rss_items')
            .select('id')
            .limit(100);
            
        if (error) throw error;
        if (!items || items.length === 0) {
            console.log('❌ Новини не знайдені в базі');
            return;
        }

        console.log(`📊 Отримано ${items.length} новин для аналізу.`);

        let zaiCount = 0;
        let dsCount = 0;
        let invalidCount = 0;

        items.forEach(item => {
            const uuid = item.id;
            const lastChar = uuid.slice(-1);
            const parsed = parseInt(lastChar, 16);
            
            if (isNaN(parsed)) {
                invalidCount++;
                console.log(`⚠️  Invalid UUID char: ${uuid} -> ${lastChar}`);
                return;
            }

            if (parsed % 2 === 0) {
                zaiCount++;
            } else {
                dsCount++;
            }
        });

        console.log('\n📈 Результат розподілу за поточним алгоритмом:');
        console.log(`   Z.AI (Even): ${zaiCount}`);
        console.log(`   DeepSeek (Odd): ${dsCount}`);
        console.log(`   Invalid: ${invalidCount}`);

        // Спробуємо інший алгоритм про всяк випадок
        let zaiCount2 = 0;
        let dsCount2 = 0;
        items.forEach((item, idx) => {
            if (idx % 2 === 0) zaiCount2++; else dsCount2++;
        });
        console.log('\n📊 Результат за простим Index-based розподілом:');
        console.log(`   Z.AI: ${zaiCount2}`);
        console.log(`   DeepSeek: ${dsCount2}`);

        // Перевіряємо завантажені новини без key_points
        const { count, error: countError } = await supabase
            .from('news_rss_items')
            .select('*', { count: 'exact', head: true })
            .is('key_points', null);
            
        console.log(`\n📬 Всього новин без key_points в базі: ${count}`);

    } catch (e) {
        console.error('💥 Помилка:', e.message);
    }
}

deepDebug();