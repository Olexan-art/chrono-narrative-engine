// Детальна діагностика Z.AI помилок
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.C8PmpRzpxUe3jKDRk5ZOlQjXW_5-Z_vLSZNRRUafFQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseZaiErrors() {
    console.log('🔍 Детальна діагностика Z.AI помилок...');

    try {
        const { data, error } = await supabase.functions.invoke('bulk-retell-news-zai', {
            body: JSON.stringify({
                country_code: 'US',
                time_range: 'last_1h',
                max_items: 3,
                job_name: 'debug_zai_errors',
                trigger: 'manual'
            })
        });

        if (error) {
            console.error('❌ Z.AI function error:', error.message);
            return;
        }

        console.log('\n📊 Z.AI Response Details:');
        console.log('processed:', data.processed);
        console.log('success_count:', data.success_count);
        console.log('error_count:', data.error_count);
        console.log('skipped:', data.skipped);
        console.log('total:', data.total);

        if (data.details?.errors && data.details.errors.length > 0) {
            console.log('\n❌ Error Details:');
            data.details.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }

        if (data.details) {
            console.log('\n🔧 Processing Details:');
            console.log('provider:', data.details.provider);
            console.log('parallel_processing:', data.details.parallel_processing);
            console.log('time_range:', data.details.time_range);
            console.log('country_code:', data.details.country_code);
        }

    } catch (e) {
        console.error('💥 Critical error:', e.message);
    }
}

diagnoseZaiErrors();