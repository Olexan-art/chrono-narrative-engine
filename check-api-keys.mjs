// Перевірка API ключів в базі даних
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkApiKeys() {
    console.log('🔑 Перевіряю API ключі в базі даних...');
    
    try {
        // Прямий запрос до settings
        const { data, error } = await supabase
            .from('settings')
            .select('id, zai_api_key, deepseek_api_key')
            .single();
            
        if (error) {
            console.error('❌ Помилка доступу до settings:', error.message);
            
            // Спробуємо через admin функцію
            console.log('\n🔄 Спробуємо через admin функцію...');
            const { data: adminData, error: adminError } = await supabase.functions.invoke('admin', {
                body: JSON.stringify({
                    action: 'getSettings',
                    password: '123'
                })
            });
            
            if (adminError) {
                console.error('❌ Admin помилка:', adminError.message);  
                console.log('🚨 Не можемо перевірити API ключі - проблема з доступом');
                return;
            } else {
                console.log('✅ Settings через admin:', adminData);
            }
        } else {
            console.log('✅ Direct settings access:');
            console.log('ID:', data?.id);
            console.log('Z.AI key present:', !!data?.zai_api_key);
            console.log('DeepSeek key present:', !!data?.deepseek_api_key);
            
            if (!data?.zai_api_key) {
                console.log('⚠️  Z.AI API ключ ВІДСУТНІЙ в базі');
            }
            if (!data?.deepseek_api_key) {
                console.log('⚠️  DeepSeek API ключ ВІДСУТНІЙ в базі');
            }
        }
        
    } catch (e) {
        console.error('💥 Critical error:', e.message);
    }
}

checkApiKeys();