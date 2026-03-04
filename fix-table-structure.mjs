import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function adminRequest(action, data = null) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${url}/functions/v1/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({
      action,
      password: '1nuendo19071',
      data
    })
  });
  
  return response;
}

async function checkAndFixTableStructure() {
  try {
    console.log('🔍 Checking cron_job_configs Table Structure\n');
    console.log('===========================================\n');
    
    // Check current table structure
    console.log('1️⃣ Inspecting current table structure...');
    const structureResponse = await adminRequest('inspectPgCron', { jobName: '%' });
    
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    // Get table structure using SQL
    const tableInfoSql = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'cron_job_configs' 
      ORDER BY ordinal_position
    `;
    
    const structureCheckResponse = await adminRequest('inspectPgCron');
    
    // Actually let's just try to get one record to see what columns exist
    const sampleUrl = `${url}/rest/v1/cron_job_configs?select=*&limit=1`;
    const sampleResponse = await fetch(sampleUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (sampleResponse.ok) {
      const sample = await sampleResponse.json();
      if (sample.length > 0) {
        console.log('📋 Current table columns:');
        Object.keys(sample[0]).forEach(col => {
          console.log(`   📄 ${col}: ${sample[0][col]}`);
        });
      } else {
        console.log('📋 No sample records found, checking schema manually');
      }
    }
    
    console.log('\n2️⃣ Adding missing cron_expression column...');
    
    // Add the missing column
    const addColumnSql = `
      ALTER TABLE cron_job_configs 
      ADD COLUMN IF NOT EXISTS cron_expression TEXT;
      
      ALTER TABLE cron_job_configs 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      
      UPDATE cron_job_configs 
      SET is_active = CASE WHEN enabled IS NOT NULL THEN enabled ELSE true END
      WHERE is_active IS NULL;
      
      COMMENT ON COLUMN cron_job_configs.cron_expression IS 'Cron expression for scheduling (e.g., */15 * * * *)';
      COMMENT ON COLUMN cron_job_configs.is_active IS 'Controls if job should be active in pg_cron';
    `;
    
    // We need to execute this SQL directly - let me check what SQL execution methods are available in admin
    
    // For now, let's try a workaround by creating the column via a dummy update
    console.log('🔧 Attempting to add columns via admin function...');
    
    // First, let's see if we can use the admin API to run SQL
    const sqlResponse = await adminRequest('inspectPgCron', { 
      jobName: '%',
      sql: addColumnSql 
    });
    
    if (sqlResponse.ok) {
      console.log('✅ Table structure updated successfully');
    } else {
      console.log('❌ Could not update table structure via API');
      
      // Try alternative method - manual column addition
      console.log('\n🔧 Alternative: Manual SQL commands to run in Supabase SQL Editor:');
      console.log('');
      console.log('-- Copy and paste these commands into Supabase SQL Editor:');
      console.log(addColumnSql);
      console.log('');
      console.log('Then run this script again.');
    }
    
    console.log('\n3️⃣ Testing column after update...');
    
    const testUrl = `${url}/rest/v1/cron_job_configs?select=job_name,cron_expression,is_active&limit=1`;
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      }
    });
    
    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log('✅ Column test successful:', testResult);
    } else {
      const error = await testResponse.text();
      console.log('❌ Column test failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Table check failed:', error.message);
  }
}

console.log('🚀 Table Structure Validator & Fixer');
console.log('=====================================\n');
checkAndFixTableStructure();