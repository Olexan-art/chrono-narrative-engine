// Apply migration directly to Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.XKqWqIwfy5BoKzQNNUhs5uYC_QI0GLLKXw1pBDgkCi0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying entity_views migration...');
  
  try {
    const sql = readFileSync('supabase/migrations/20260221000000_add_entity_views_log.sql', 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 10);
    
    console.log(`Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(stmt.substring(0, 100) + '...');
      
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      
      if (error) {
        // Try alternative approach - direct table creation
        if (stmt.includes('CREATE TABLE')) {
          console.log('⚠️  RPC method not available, using manual check...');
          const { data, error: checkError } = await supabase
            .from('entity_views')
            .select('id')
            .limit(1);
          
          if (!checkError) {
            console.log('✅ Table already exists');
            continue;
          }
        }
        console.error('❌ Error:', error.message);
      } else {
        console.log('✅ Success');
      }
    }
    
    console.log('\n✨ Migration completed!');
    
    // Verify table exists
    const { data, error } = await supabase
      .from('entity_views')
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log('✅ Verified: entity_views table exists');
    } else {
      console.log('⚠️  Table verification:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Please apply SQL manually:');
    console.log('   https://supabase.com/dashboard/project/tuledxqigzufkecztnlo/sql/new');
  }
}

applyMigration();
