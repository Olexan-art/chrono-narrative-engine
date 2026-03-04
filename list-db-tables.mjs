import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listTables() {
  console.log('🔍 Looking for database tables...\n');
  
  try {
    // Try to get schema information
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (error) {
      console.log('Could not fetch via information_schema, trying alternative...');
      // Try different table names
      const tableNames = [
        'cron_configs',
        'cron_config',
        'cron_jobs',
        'cron_job_config',
        'cron_job_events',
        'cron_events'
      ];
      
      for (const tableName of tableNames) {
        try {
          const result = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!result.error) {
            console.log(`✅ Found table: ${tableName}`);
          }
        } catch (e) {
          // Table doesn't exist, continue
        }
      }
      
      return;
    }
    
    const tables = data.map(t => t.table_name);
    console.log(`Found ${tables.length} tables in public schema:\n`);
    tables.forEach(t => console.log(`  - ${t}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listTables();
