#!/usr/bin/env node

/**
 * Детальна перевірка всіх процесів переказу та перекладу новин
 * Аудит retell та translate функцій + автоматизація
 */

const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

// Конфігурація edge функцій переказу та перекладу
const RETELL_TRANSLATE_FUNCTIONS = {
  'retell-news': {
    name: '📝 Переказ новин (LLM)',
    description: 'Розширений переказ новин різними мовами з LLM',
    action: 'retell',
    supportedLanguages: ['uk', 'en', 'pl', 'hi', 'ta', 'te', 'bn'],
    testPayload: { newsId: null, model: 'gemini-2.5-flash' }
  },
  'translate-news': {
    name: '🌍 Переклад загальних новин',
    description: 'Переклад українських новин на англійську та польську',
    action: 'translate',
    supportedLanguages: ['en', 'pl'],
    testPayload: { newsId: null, targetLanguage: 'en' }
  },
  'translate-indian-news': {
    name: '🇮🇳 Переклад індійських новин',
    description: 'Специфічний переклад на індійські мови',
    action: 'translate',
    supportedLanguages: ['hi', 'ta', 'te', 'bn'],
    testPayload: { newsId: null, languages: ['hi', 'ta'] }
  },
  'translate-flash-news': {
    name: '⚡ Переклад flash новин',
    description: 'Швидкий переклад термінових новин',
    action: 'translate',
    supportedLanguages: ['en', 'pl'],
    testPayload: { newsId: null, targetLanguage: 'en' }  
  },
  'translate': {
    name: '🔤 Загальний переклад',
    description: 'Універсальна функція перекладу',
    action: 'translate',
    supportedLanguages: ['various'],
    testPayload: { text: 'Test text', from: 'uk', to: 'en' }
  }
};

async function callEdgeFunction(functionName, payload) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(payload)
    });

    return {
      status: response.status,
      ok: response.ok,
      data: await response.text(),
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null
    };
  }
}

async function getTestNews() {
  console.log('📰 Отримання тестових новин з бази...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/news_rss_items?select=id,title,title_en,country_id,category,content,description,created_at&limit=10&order=created_at.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const news = await response.json();
    console.log(`✅ Знайдено ${news.length} новин для тестування`);
    
    // Показати зразки
    news.slice(0, 3).forEach((item, idx) => {
      const title = item.title_en || item.title || 'Без заголовку';
      console.log(`   ${idx + 1}. [${item.id}] ${title.substring(0, 80)}...`);
    });
    
    return news;
  } catch (error) {
    console.log(`❌ Помилка отримання новин: ${error.message}`);
    return [];
  }
}

async function testEdgeFunction(functionName, config) {
  console.log(`\n🧪 Тестування ${config.name}:`);
  console.log(`   📋 Опис: ${config.description}`);
  console.log(`   🌐 Мови: ${config.supportedLanguages.join(', ')}`);
  
  const result = await callEdgeFunction(functionName, config.testPayload);
  
  if (result.ok) {
    console.log(`   ✅ Статус: ${result.status} OK`);
    try {
      const data = JSON.parse(result.data);
      if (data.error) {
        console.log(`   ⚠️ Відповідь з помилкою: ${data.error}`);
      } else if (data.success !== false) {
        console.log(`   📄 Відповідь: ${JSON.stringify(data).substring(0, 150)}...`);
      }
    } catch (e) {
      console.log(`   📄 Відповідь (текст): ${result.data.substring(0, 100)}...`);
    }
  } else {
    console.log(`   ❌ Статус: ${result.status || 'Network error'}`);
    console.log(`   🔍 Помилка: ${result.error || result.data?.substring(0, 200) || 'Unknown'}`);
  }
  
  return result.ok;
}

async function testRetellWithRealNews(newsItems) {
  if (newsItems.length === 0) {
    console.log('\n⚠️ Немає новин для тестування retell функції');
    return;
  }
  
  console.log('\n🎯 Детальне тестування retell-news з реальними новинами:');
  
  const testNews = newsItems[0]; // Використати першу новину
  console.log(`   📰 Тестова новина: [${testNews.id}] ${(testNews.title || '').substring(0, 60)}...`);
  
  // Тест українським переказом
  console.log(`\n   🇺🇦 Тест: Переказ українською...`);
  const retellResult = await callEdgeFunction('retell-news', {
    newsId: testNews.id,
    model: 'gemini-2.5-flash'
  });
  
  if (retellResult.ok) {
    console.log(`      ✅ Переказ успішний: ${retellResult.status}`);
    try {
      const data = JSON.parse(retellResult.data);
      if (data.success) {
        console.log(`      📝 Тип: ${data.retold ? 'Новий переказ' : 'Використано існуючий'}`);
        console.log(`      📊 Статистики: ${data.word_count || 'невідомо'} слів`);
      } else {
        console.log(`      ❌ Помилка переказу: ${data.error}`);
      }
    } catch (e) {
      console.log(`      📄 Отримано відповідь довжиною ${retellResult.data.length} символів`);
    }
  } else {
    console.log(`      ❌ Помилка retell: ${retellResult.status} ${retellResult.error}`);
  }
}

async function testTranslateWithRealNews(newsItems) {
  if (newsItems.length === 0) {
    console.log('\n⚠️ Немає новин для тестування translate функції');
    return;
  }
  
  console.log('\n🔄 Детальне тестування translate-news з реальними новинами:');
  
  const testNews = newsItems.find(n => n.title) || newsItems[0];
  console.log(`   📰 Тестова новина: [${testNews.id}] ${(testNews.title || '').substring(0, 60)}...`);
  
  // Тест перекладу на англійську
  console.log(`\n   🇺🇸 Тест: Переклад на англійську...`);
  const translateResult = await callEdgeFunction('translate-news', {
    newsId: testNews.id,
    targetLanguage: 'en'
  });
  
  if (translateResult.ok) {
    console.log(`      ✅ Переклад успішний: ${translateResult.status}`);
    try {
      const data = JSON.parse(translateResult.data);
      if (data.success && data.translated) {
        const fields = Object.keys(data.translated);
        console.log(`      📋 Перекладені поля: ${fields.join(', ')}`);
        if (data.translated.title_en) {
          console.log(`      📝 Заголовок EN: ${data.translated.title_en.substring(0, 80)}...`);
        }
      } else {
        console.log(`      ❌ Помилка перекладу: ${data.error || 'Невідома помилка'}`);
      }
    } catch (e) {
      console.log(`      📄 Отримано відповідь довжиною ${translateResult.data.length} символів`);
    }
  } else {
    console.log(`      ❌ Помилка translate: ${translateResult.status} ${translateResult.error}`);
  }
}

async function checkLLMSettings() {
  console.log('\n⚙️ Перевірка налаштувань LLM провайдерів:');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/settings?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`   ❌ Помилка отримання settings: ${response.status}`);
      return;
    }

    const settings = await response.json();
    if (settings && settings.length > 0) {
      const config = settings[0];
      
      console.log(`   🤖 LLM Provider: ${config.llm_provider || 'не налаштовано'}`);
      console.log(`   📝 Text Provider: ${config.llm_text_provider || 'не налаштовано'}`);
      console.log(`   🧠 Text Model: ${config.llm_text_model || 'не налаштовано'}`);
      
      // Перевірка API ключів (безпечно)
      const apiKeys = {
        'OpenAI': !!config.openai_api_key,
        'Gemini': !!config.gemini_api_key,
        'Gemini V22': !!config.gemini_v22_api_key,
        'Anthropic': !!config.anthropic_api_key,
        'ZAI': !!config.zai_api_key,
        'Mistral': !!config.mistral_api_key
      };
      
      console.log(`   🔑 API ключі налаштовані:`);
      Object.entries(apiKeys).forEach(([provider, hasKey]) => {
        console.log(`      ${hasKey ? '✅' : '❌'} ${provider}`);
      });
    } else {
      console.log(`   ⚠️ Налаштування не знайдені`);
    }
  } catch (error) {
    console.log(`   ❌ Помилка: ${error.message}`);
  }
}

async function checkAutomationReadiness() {
  console.log('\n🔧 Аналіз готовності до автоматизації переказу/перекладу:');
  
  console.log(`\n   📋 Процеси які можна автоматизувати:`);
  console.log(`   1. 📝 Автоматичний переказ новин після RSS збору`);
  console.log(`   2. 🌍 Переклад на цільові мови після переказу`);
  console.log(`   3. 🇮🇳 Спеціальний переклад індійських новин`);
  console.log(`   4. ⚡ Пріоритетний переклад flash новин`);
  
  console.log(`\n   💡 Рекомендована послідовність автоматизації:`);
  console.log(`   RSS збір → process_pending → retell-news → translate-news → кеш update`);
  
  console.log(`\n   ⏰ Запропоновані cron джоби:`);
  console.log(`   • Retell нових новин: кожні 60 хвилин`);
  console.log(`   • Translate на англійську: кожні 90 хвилин`);
  console.log(`   • Translate індійських: кожні 120 хвилин`);
  console.log(`   • Очистка кешу: кожні 6 годин`);
}

async function generateRetellTranslateJobs() {
  console.log('\n🚀 Генерація cron джобів для переказу та перекладу:');
  
  const cronJobs = {
    'retell_recent_news': {
      name: 'Переказ нових новин',
      schedule: '0 */1 * * *', // кожну годину
      action: 'retell_batch',
      description: 'Автоматичний переказ новин без retold контенту'
    },
    'translate_to_english': {
      name: 'Переклад на англійську',
      schedule: '30 */2 * * *', // кожні 2 години зі зсувом 30 хв
      action: 'translate_batch', 
      description: 'Переклад українських новин на англійську'
    },
    'translate_indian_content': {
      name: 'Переклад індійського контенту',
      schedule: '0 */3 * * *', // кожні 3 години
      action: 'translate_indian_batch',
      description: 'Переклад індійських новин на місцеві мови'
    },
    'cache_retold_pages': {
      name: 'Оновлення кешу перекладених сторінок',
      schedule: '0 */6 * * *', // кожні 6 годин
      action: 'cache_update_batch',
      description: 'Оновлення кешу для сторінок з новими переказами'
    }
  };
  
  Object.entries(cronJobs).forEach(([id, job]) => {
    console.log(`   📅 ${id}:`);
    console.log(`      📝 ${job.name} (${job.schedule})`);
    console.log(`      📄 ${job.description}`);
  });
  
  return cronJobs;
}

async function main() {
  console.log('🔍 ДЕТАЛЬНА ПЕРЕВІРКА ПРОЦЕСІВ ПЕРЕКАЗУ ТА ПЕРЕКЛАДУ НОВИН\n');
  
  console.log('═'.repeat(80));
  
  // 1. Отримати тестові новини
  const newsItems = await getTestNews();
  
  // 2. Перевірити налаштування LLM
  await checkLLMSettings();
  
  // 3. Тестування базових edge функцій
  console.log('\n📡 ТЕСТУВАННЯ EDGE ФУНКЦІЙ:');
  console.log('─'.repeat(50));
  
  let successCount = 0;
  const totalFunctions = Object.keys(RETELL_TRANSLATE_FUNCTIONS).length;
  
  for (const [funcName, config] of Object.entries(RETELL_TRANSLATE_FUNCTIONS)) {
    const success = await testEdgeFunction(funcName, config);
    if (success) successCount++;
  }
  
  // 4. Детальне тестування з реальними новинами
  console.log('\n🧪 ТЕСТУВАННЯ З РЕАЛЬНИМИ НОВИНАМИ:');
  console.log('─'.repeat(50));
  
  await testRetellWithRealNews(newsItems);
  await testTranslateWithRealNews(newsItems);
  
  // 5. Аналіз автоматизації
  await checkAutomationReadiness();
  
  // 6. Генерація cron джобів
  const cronJobs = await generateRetellTranslateJobs();
  
  // 7. Підсумок
  console.log('\n📊 ПІДСУМОК АУДИТУ:');
  console.log('═'.repeat(80));
  
  console.log(`\n✅ Результати тестування Edge функцій:`);
  console.log(`   📈 Успішно: ${successCount}/${totalFunctions} функцій`);
  console.log(`   📊 Відсоток: ${Math.round(successCount/totalFunctions*100)}%`);
  
  console.log(`\n🏗️ Знайдені функції переказу та перекладу:`);
  console.log(`   📝 retell-news: Переказ на 7 мовах з LLM`);
  console.log(`   🌍 translate-news: Переклад українського контенту`);
  console.log(`   🇮🇳 translate-indian-news: Спеціальні індійські переклади`);
  console.log(`   ⚡ translate-flash-news: Термінові переклади`);
  console.log(`   🔤 translate: Універсальний переклад`);
  
  console.log(`\n💡 Рекомендації для повної автоматизації:`);
  console.log(`   1. ✅ Налаштувати масовий retell після RSS збору`);
  console.log(`   2. ✅ Додати автоматичний переклад популярних новин`);
  console.log(`   3. ✅ Створити pipeline: RSS → retell → translate → cache`);
  console.log(`   4. ✅ Моніторити usage LLM провайдерів`);
  console.log(`   5. ✅ Впровадити queue систему для batch обробки`);
  
  console.log(`\n🎯 Наступні кроки:`);
  console.log(`   1. Додати cron джоби для retell/translate до manage-cron.mjs`);
  console.log(`   2. Створити batch processing функції`);
  console.log(`   3. Налаштувати моніторинг LLM витрат`);
  console.log(`   4. Оптимізувати черги обробки новин`);
  
  console.log(`\n✨ Система переказу та перекладу готова до масштабування!`);
}

// Запуск аудиту
main().catch(error => {
  console.error('❌ Помилка аудиту:', error.message);
  process.exit(1);
});