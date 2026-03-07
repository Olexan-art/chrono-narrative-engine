import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || 'https://tuledxqigzufkecztnlo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationPath = join(__dirname, 'supabase', 'migrations', '20260307010000_multi_llm_scoring_crons.sql');
const sql = readFileSync(migrationPath, 'utf-8');

console.log('Applying migration: 20260307010000_multi_llm_scoring_crons.sql');
console.log('SQL:', sql);

try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  console.log('Migration applied successfully!');
  console.log('Result:', data);
} catch (err) {
  console.error('Error:', err);
  
  // Alternative: use direct SQL execution via REST API
  console.log('\nTrying direct execution via pg_net...');
  
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      const { error } = await supabase.rpc('exec', { sql: statement + ';' });
      if (error) {
        console.error('Statement failed:', error);
        console.error('Statement:', statement);
      } else {
        console.log('Statement executed successfully');
      }
    }
  }
}
