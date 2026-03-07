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

const EDGE_FUNCTION_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/score-news-source`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testScoring() {
  console.log('🧪 Тестування Source Scoring з auto_select (як cron)\n');

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        auto_select: true,
        llm_model: 'GLM-4.7-Flash'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Помилка:', result);
      return;
    }

    if (result.success) {
      console.log('✅ Оцінка успішна!\n');
      console.log(`📰 Новина: ${result.newsTitle || 'N/A'}`);
      console.log(`🔗 URL: ${result.newsUrl || 'N/A'}`);
      console.log(`🏆 Загальний бал: ${result.scoring?.overall || 0}/100`);
      console.log(`📊 Детальні оцінки:`);
      console.log(`   - Важливість: ${result.scoring?.importance || 0}`);
      console.log(`   - Надійність: ${result.scoring?.reliability || 0}`);
      console.log(`   - Підтвердження: ${result.scoring?.corroboration || 0}`);
      console.log(`   - Ясність scope: ${result.scoring?.scope_clarity || 0}`);
      console.log(`   - Ризик волатильності: ${result.scoring?.volatility_risk || 0}`);
      console.log(`\n⏱️  Час: ${result.executionTime || 'N/A'}ms`);
      console.log(`🤖 Модель: ${result.llmModel || 'N/A'}`);
    } else {
      console.log('❌ Невдача:', result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Помилка виклику:', error.message);
  }
}

testScoring();
