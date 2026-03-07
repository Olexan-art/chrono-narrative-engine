import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScoringSettings() {
  console.log('📋 Перевірка налаштувань Source Scoring\n');

  const { data, error } = await supabase
    .from('settings')
    .select('source_scoring_enabled, source_scoring_zai_enabled, source_scoring_gemini_enabled, source_scoring_deepseek_enabled, source_scoring_openai_enabled')
    .single();

  if (error) {
    console.error('❌ Помилка запиту:', error.message);
    console.log('\n⚠️  Можливо міграція ще не застосована. Виконайте SQL з файлу:');
    console.log('   APPLY_SOURCE_SCORING_SETTINGS.md\n');
    return;
  }

  const masterEnabled = data.source_scoring_enabled ?? true;
  const zaiEnabled = data.source_scoring_zai_enabled ?? true;
  const geminiEnabled = data.source_scoring_gemini_enabled ?? true;
  const deepseekEnabled = data.source_scoring_deepseek_enabled ?? true;
  const openaiEnabled = data.source_scoring_openai_enabled ?? true;

  console.log('🎛️  Загальний вимикач кронів:');
  console.log(`   ${masterEnabled ? '✅ УВІМКНЕНО' : '❌ ВИМКНЕНО'}\n`);

  console.log('🤖 Статус провайдерів:\n');

  const providers = [
    { name: 'Z.AI (GLM-4.7-Flash)', enabled: zaiEnabled, schedule: 'Кожні 30 хв (00, 30)', color: '🟢' },
    { name: 'Gemini (2.5-flash)', enabled: geminiEnabled, schedule: 'Кожну годину о :15', color: '🟣' },
    { name: 'DeepSeek (deepseek-chat)', enabled: deepseekEnabled, schedule: 'Кожну годину о :30', color: '🔵' },
    { name: 'OpenAI (gpt-4o-mini)', enabled: openaiEnabled, schedule: 'Кожні 3 години о :00', color: '🔷' },
  ];

  providers.forEach(provider => {
    const status = masterEnabled && provider.enabled ? '✅ Активний' : '⏸️  Призупинено';
    const reason = !masterEnabled ? ' (вимкнено глобально)' : !provider.enabled ? ' (вимкнено провайдер)' : '';
    console.log(`${provider.color} ${provider.name}`);
    console.log(`   Статус: ${status}${reason}`);
    console.log(`   Розклад: ${provider.schedule}`);
    console.log();
  });

  const activeCount = [zaiEnabled, geminiEnabled, deepseekEnabled, openaiEnabled].filter(Boolean).length;
  const totalActive = masterEnabled ? activeCount : 0;

  console.log(`\n📊 Підсумок: ${totalActive}/4 провайдер(ів) активно працює\n`);

  if (!masterEnabled) {
    console.log('⚠️  УВАГАВсі source scoring крони вимкнено глобальним перемикачем!');
    console.log('   Увімкніть через Admin Dashboard або виконайте SQL:');
    console.log('   UPDATE settings SET source_scoring_enabled = true;\n');
  } else if (totalActive === 0) {
    console.log('⚠️  УВАГА: Всі провайдери вимкнено!');
    console.log('   Увімкніть хоча б один через Admin Dashboard\n');
  }
}

checkScoringSettings().catch(console.error);
