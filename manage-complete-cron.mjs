#!/usr/bin/env node

/**
 * ПОВНА СИСТЕМА УПРАВЛІННЯ RSS + RETELL + TRANSLATE АВТОМАТИЗАЦІЄЮ
 * Управляє збором новин, переказами та перекладами
 */

const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

// РОЗШИРЕНА КОНФІГУРАЦІЯ: RSS + RETELL + TRANSLATE CRON ДЖОБИ  
const COMPLETE_CRON_JOBS = {
  // === RSS ЗБІР НОВИН ===
  'fetch_usa': {
    name: '🇺🇸 Збір новин США',
    schedule: '*/30 * * * *', // кожні 30 хвилин
    action: 'rss',
    endpoint: 'fetch-rss',
    payload: { action: 'fetch_country', country_id: '1f57c11e-ab27-4e4e-b289-ca31dc80e895' },
    priority: 'high'
  },
  'fetch_ukraine': {
    name: '🇺🇦 Збір новин України', 
    schedule: '*/45 * * * *', // кожні 45 хвилин
    action: 'rss',
    endpoint: 'fetch-rss',
    payload: { action: 'fetch_country', country_id: 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11' },
    priority: 'high'
  },
  'fetch_uk': {
    name: '🇬🇧 Збір новин Британії',
    schedule: '0 */2 * * *', // кожні 2 години
    action: 'rss',
    endpoint: 'fetch-rss', 
    payload: { action: 'fetch_country', country_id: '816cd62f-df7a-451e-8356-879dffd97d16' },
    priority: 'medium'
  },
  // 'fetch_india': {
  //   name: '🇮🇳 Збір новин Індії',
  //   schedule: '15 */2 * * *', // кожні 2 години зі зсувом
  //   action: 'rss',
  //   endpoint: 'fetch-rss',
  //   payload: { action: 'fetch_country', country_id: 'f07acf0c-d33c-464c-a208-a456205e012f' },
  //   priority: 'medium'
  // },
  'process_pending': {
    name: '📥 Обробка pending новин',
    schedule: '*/15 * * * *', // кожні 15 хвилин
    action: 'rss', 
    endpoint: 'fetch-rss',
    payload: { action: 'process_pending' },
    priority: 'critical'
  },
  
  // === ПЕРЕКАЗ НОВИН ===
  'retell_recent_usa': {
    name: '📝 Переказ новин США (ZAI + DeepSeek)',
    schedule: '5 */1 * * *', // кожну годину, 5 хвилин після rss
    action: 'retell',
    endpoint: 'retell-news',
    payload: { batch: true, country: 'usa', limit: 20, model: 'GLM-4.7-Flash', provider: 'zai' },
    priority: 'high',
    depends_on: ['fetch_usa']
  },
  'retell_recent_usa_zai': {
    name: '📝 Переказ новин США (ZAI)',
    schedule: '5 */1 * * *', // кожну годину, 5 хвилин після рss
    action: 'retell',
    endpoint: 'retell-news',
    payload: { batch: true, country: 'usa', limit: 20, model: 'GLM-4.7-Flash', provider: 'zai' },
    priority: 'high',
    depends_on: ['fetch_usa']
  },
  'retell_recent_usa_deepseek': {
    name: '📝 Переказ новин США (DeepSeek)',
    schedule: '35 */1 * * *', // кожну годину, 35 хвилин після рss
    action: 'retell',
    endpoint: 'retell-news',
    payload: { batch: true, country: 'usa', limit: 20, model: 'deepseek-chat', provider: 'deepseek' },
    priority: 'high',
    depends_on: ['fetch_usa']
  },
  // 'retell_recent_ukraine_zai': {
  //   name: '📝 Переказ новин України (ZAI)',
  //   schedule: '10 */1 * * *', // кожну годину, 10 хвилин після rss
  //   action: 'retell',
  //   endpoint: 'retell-news',  
  //   payload: { batch: true, country: 'ukraine', limit: 10, model: 'GLM-4.7-Flash', provider: 'zai' },
  //   priority: 'high',
  //   depends_on: ['fetch_ukraine']
  // },
  // 'retell_recent_ukraine_deepseek': {
  //   name: '📝 Переказ новин України (DeepSeek)',
  //   schedule: '40 */1 * * *', // кожну годину, 40 хвилин після rss
  //   action: 'retell',
  //   endpoint: 'retell-news',  
  //   payload: { batch: true, country: 'ukraine', limit: 10, model: 'deepseek-chat', provider: 'deepseek' },
  //   priority: 'high',
  //   depends_on: ['fetch_ukraine']
  // },
  // 'retell_recent_global_zai': {
  //   name: '📝 Переказ глобальних новин (ZAI)',
  //   schedule: '30 */2 * * *', // кожні 2 години
  //   action: 'retell',
  //   endpoint: 'retell-news',
  //   payload: { batch: true, global: true, limit: 15, model: 'GLM-4.7-Flash', provider: 'zai' },
  //   priority: 'medium'
  // },
  // 'retell_recent_global_deepseek': {
  //   name: '📝 Переказ глобальних новин (DeepSeek)',
  //   schedule: '0 1,3,5,7,9,11,13,15,17,19,21,23 * * *', // кожні 2 години зі зсувом
  //   action: 'retell',
  //   endpoint: 'retell-news',
  //   payload: { batch: true, global: true, limit: 15, model: 'deepseek-chat', provider: 'deepseek' },
  //   priority: 'medium'
  // },
  
  // === ПЕРЕКЛАД НОВИН ===
  // 'translate_ukraine_to_english': {
  //   name: '🌍 Переклад UA→EN',
  //   schedule: '20 */2 * * *', // кожні 2 години, після retell
  //   action: 'translate',
  //   endpoint: 'translate-news',
  //   payload: { batch: true, from_country: 'ukraine', targetLanguage: 'en', limit: 5 },
  //   priority: 'medium',
  //   depends_on: ['retell_recent_ukraine']
  // },
  // 'translate_usa_to_polish': {
  //   name: '🇵🇱 Переклад US→PL',
  //   schedule: '25 */3 * * *', // кожні 3 години
  //   action: 'translate', 
  //   endpoint: 'translate-news',
  //   payload: { batch: true, from_country: 'usa', targetLanguage: 'pl', limit: 3 },
  //   priority: 'low'
  // },
  // 'translate_indian_languages': {
  //   name: '🇮🇳 Переклад індійських мов',
  //   schedule: '40 */4 * * *', // кожні 4 години
  //   action: 'translate',
  //   endpoint: 'translate-indian-news', 
  //   payload: { batch: true, languages: ['hi', 'ta'], limit: 5 },
  //   priority: 'medium',
  //   depends_on: ['fetch_india']
  // },
  'translate_flash_urgent': {
    name: '⚡ Термінові переклади',
    schedule: '*/20 * * * *', // кожні 20 хвилин
    action: 'translate',
    endpoint: 'translate-flash-news',
    payload: { urgent: true, targetLanguage: 'en', limit: 2 },
    priority: 'high'
  },
  
  // === МОНІТОРИНГ ТА СТАТИСТИКИ ===
  'stats_check': {
    name: '📊 Перевірка статистик',
    schedule: '0 */6 * * *', // кожні 6 годин
    action: 'monitor',
    endpoint: 'fetch-rss',
    payload: { action: 'get_cron_stats' },
    priority: 'low'
  },
  'llm_usage_monitor': {
    name: '🤖 Моніторинг LLM витрат',
    schedule: '0 8,20 * * *', // 8:00 та 20:00 щодня
    action: 'monitor',
    endpoint: 'internal', // буде реалізовано окремо
    payload: { check_usage: true, report: true },
    priority: 'medium'
  },
  'cache_cleanup': {
    name: '🧹 Очистка кешу перекладів',
    schedule: '0 2 * * *', // щодня о 2:00
    action: 'maintenance',
    endpoint: 'cache-pages',
    payload: { action: 'cleanup-retold' },
    priority: 'low'
  }
};

async function callEdgeFunction(endpoint, payload) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    
    return {
      status: response.status,
      success: response.ok,
      data: result,
      endpoint: endpoint
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message,
      endpoint: endpoint
    };
  }
}

// Агрегувати останні cron події і показати статистику по retell
async function fetchAndShowRecentRetellStats() {
  console.log('\n🔎 Отримую останні події cron (run_finished) через admin.getCronEvents...');
  const resp = await callEdgeFunction('admin', { action: 'getCronEvents', password: '1nuendo19071', data: { limit: 500 } });
  if (!resp.success) {
    console.log('   ❌ Не вдалося отримати події:', resp.status, resp.error || resp.data?.substring(0,200));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(resp.data);
  } catch (e) {
    console.log('   ❌ Невірний формат відповіді admin.getCronEvents');
    return;
  }

  const events = (payload.events || []).filter(e => e.event_type === 'run_finished');
  const now = Date.now();
  const windows = { '10m': 10 * 60 * 1000, '20m': 20 * 60 * 1000, '30m': 30 * 60 * 1000 };

  const rowsMap = new Map();

  for (const ev of events) {
    const created = new Date(ev.created_at).getTime();
    const jobName = ev.job_name || (ev.details && ev.details.job_name) || 'unknown';
    const details = ev.details || {};

    // determine provider/model
    let provider = details.provider || 'unknown';
    let model = details.llm_model || details.model || (COMPLETE_CRON_JOBS[jobName] && COMPLETE_CRON_JOBS[jobName].payload && COMPLETE_CRON_JOBS[jobName].payload.model) || 'unknown';
    if (provider === 'unknown') {
      if (jobName && jobName.toLowerCase().includes('deepseek')) provider = 'deepseek';
      else if (jobName && jobName.toLowerCase().includes('zai')) provider = 'zai';
      else if (String(model).toLowerCase().includes('glm') || String(model).toLowerCase().includes('zai')) provider = 'zai';
    }

    const processed = Number(details.success_count || details.processed || details.success || 0) || 0;

    const key = `${provider}||${model}||${jobName}`;
    if (!rowsMap.has(key)) {
      rowsMap.set(key, { provider, model, job: jobName, '10m': 0, '20m': 0, '30m': 0, last_run_total: 0 });
    }

    const row = rowsMap.get(key);
    // add to appropriate windows
    for (const [label, ms] of Object.entries(windows)) {
      if (created >= now - ms) row[label] += processed;
    }
    row.last_run_total = Math.max(row.last_run_total, processed);
  }

  const rows = Array.from(rowsMap.values()).sort((a,b) => (b['30m'] - a['30m']));

  if (rows.length === 0) {
    console.log('   ℹ️ За останні 30 хвилин немає завершених retell подій.');
    return;
  }

  console.log('\n📋 Статистика переказів по LLM / провайдеру / джобу (останні 10/20/30 хвилин):\n');
  console.table(rows, ['provider','model','job','10m','20m','30m','last_run_total']);
}

async function runCronJob(jobId) {
  const job = COMPLETE_CRON_JOBS[jobId];
  if (!job) {
    console.log(`❌ Невідомий cron джоб: ${jobId}`);
    return false;
  }

  console.log(`🚀 ${job.name}`);
  console.log(`   ⏰ Розклад: ${job.schedule}`);
  console.log(`   🎯 Endpoint: ${job.endpoint}`);
  console.log(`   🔧 Type: ${job.action}`);
  
  if (job.depends_on) {
    console.log(`   🔗 Залежності: ${job.depends_on.join(', ')}`);
  }
  
  // Спеціальна логіка для різних типів джобів
  if (job.action === 'retell' && job.payload.batch) {
    return await runRetellBatch(job, jobId);
  } else if (job.action === 'translate' && job.payload.batch) {
    return await runTranslateBatch(job);  
  } else if (job.action === 'rss') {
    return await runRSSJob(job);
  } else {
    return await runGenericJob(job);
  }
}

async function runRSSJob(job) {
  console.log(`   📡 RSS збір...`);
  const result = await callEdgeFunction(job.endpoint, job.payload);
  
  if (result.success) {
    console.log(`   ✅ RSS успішно: ${result.status}`);
    try {
      const data = JSON.parse(result.data);
      if (data.success && data.results) {
        const processed = data.results.filter(r => !r.error).length;
        const errors = data.results.filter(r => r.error).length;
        console.log(`      📰 Успішно: ${processed}, Помилки: ${errors}`);
      } else if (data.processed) {
        console.log(`      📥 Оброблено: ${data.processed} новин`);
      }
    } catch (e) {
      console.log(`      📄 Відповідь: ${result.data.substring(0, 100)}...`);
    }
  } else {
    console.log(`   ❌ RSS помилка: ${result.status} ${result.error}`);
    if (result.data) console.log(`      🔍 Деталі: ${result.data.substring(0, 150)}`);
  }
  
  return result.success;
}

async function runRetellBatch(job, jobId) {
  console.log(`   📝 Batch переказ...`);

  if (job.payload.country) {
    console.log(`      🌍 Країна: ${job.payload.country}`);
    console.log(`      📊 Ліміт: ${job.payload.limit} новин`);
    console.log(`      🧠 Модель: ${job.payload.model}`);
    console.log(`      🔧 Провайдер: ${job.payload.provider}`);

    // Спеціальна логіка для retell_recent_usa - запускаємо обидва джоби
    if (jobId === 'retell_recent_usa') {
      console.log(`      🎯 Запуск паралельних джобів: ZAI + DeepSeek`);

      const results = [];
      results.push(await runCronJob('retell_recent_usa_zai'));
      results.push(await runCronJob('retell_recent_usa_deepseek'));

      const successCount = results.filter(Boolean).length;
      console.log(`   📊 Результат: ${successCount}/2 джобів успішно`);
      return successCount > 0;
    }

    // Викликаємо відповідну bulk-retell функцію
    const functionName = job.payload.provider === 'zai' ? 'bulk-retell-news-zai' : 'bulk-retell-news-deepseek';
    console.log(`      🎯 Виклик функції: ${functionName}`);

    const result = await callEdgeFunction(functionName, {
      country_code: job.payload.country,
      time_range: 'recent',
      llm_model: job.payload.model,
      job_name: jobId,
      trigger: 'cron'
    });
    
    if (result.success) {
      console.log(`   ✅ Batch retell успішно: ${result.status}`);
      try {
        const data = JSON.parse(result.data);
        if (data.success_count !== undefined) {
          console.log(`      📊 Оброблено: ${data.success_count} новин`);
        }
        if (data.error_count !== undefined) {
          console.log(`      ⚠️ Помилки: ${data.error_count}`);
        }
      } catch (e) {
        console.log(`      📄 Відповідь: ${result.data.substring(0, 200)}...`);
      }
    } else {
      console.log(`   ❌ Batch retell помилка: ${result.status} ${result.error}`);
      if (result.data) console.log(`      🔍 Деталі: ${result.data.substring(0, 150)}`);
    }

    return result.success;
  }

  console.log(`   ✅ Batch retell завершено (симуляція)`);
  return true;
}

async function runTranslateBatch(job) {
  console.log(`   🌍 Batch переклад...`);
  
  if (job.payload.targetLanguage) {
    console.log(`      🏳️ Цільова мова: ${job.payload.targetLanguage}`);
  }
  if (job.payload.languages) {
    console.log(`      🏳️ Цільові мови: ${job.payload.languages.join(', ')}`);
  }
  if (job.payload.from_country) {
    console.log(`      📍 З країни: ${job.payload.from_country}`);
  }
  console.log(`      📊 Ліміт: ${job.payload.limit} новин`);
  
  // TODO: Реалізувати пошук новин для перекладу та batch обробку
  console.log(`      ⏳ Очікується реалізація batch translate...`);
  
  // Наразі повертаємо симульований успіх
  console.log(`   ✅ Batch translate завершено (симуляція)`);
  return true;
}

async function runGenericJob(job) {
  const result = await callEdgeFunction(job.endpoint, job.payload);
  
  if (result.success) {
    console.log(`   ✅ ${job.action} успішно: ${result.status}`);
    if (result.data.length < 500) {
      console.log(`      📄 Результат: ${result.data}`);
    } else {
      console.log(`      📄 Відповідь довжиною ${result.data.length} символів`);
    }
  } else {
    console.log(`   ❌ ${job.action} помилка: ${result.status} ${result.error}`);
  }
  
  return result.success;
}

async function runJobsByType(type) {
  console.log(`\n🎯 Запуск усіх джобів типу: ${type.toUpperCase()}\n`);
  
  const jobs = Object.entries(COMPLETE_CRON_JOBS).filter(([id, job]) => job.action === type);
  
  if (jobs.length === 0) {
    console.log(`❌ Немає джобів типу '${type}'`);
    return {};
  }
  
  const results = {};
  for (const [jobId, job] of jobs) {
    results[jobId] = await runCronJob(jobId);
    console.log(''); // розділювач
  }
  
  const successful = Object.values(results).filter(Boolean).length;
  console.log(`📊 Результат ${type}: ${successful}/${jobs.length} джобів успішно`);
  
  return results;
}

async function runAllJobs() {
  console.log('🟢 ЗАПУСК ПОВНОЇ RSS + RETELL + TRANSLATE АВТОМАТИЗАЦІЇ\n');
  
  const results = {};
  
  // Порядок важливий: спочатку RSS, потім retell, потім translate
  console.log('🔄 Етап 1: RSS збір новин');
  const rssResults = await runJobsByType('rss');
  Object.assign(results, rssResults);
  
  console.log('\n🔄 Етап 2: Переказ новин');  
  const retellResults = await runJobsByType('retell');
  Object.assign(results, retellResults);
  
  console.log('\n🔄 Етап 3: Переклад новин');
  const translateResults = await runJobsByType('translate');
  Object.assign(results, translateResults);
  
  console.log('\n🔄 Етап 4: Моніторинг та обслуговування');
  const monitorResults = await runJobsByType('monitor');
  const maintenanceResults = await runJobsByType('maintenance');
  Object.assign(results, monitorResults, maintenanceResults);
  
  const successful = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n📊 ЗАГАЛЬНИЙ ПІДСУМОК: ${successful}/${total} джобів успішно виконано`);
  return results;
}

async function showComprehensiveStatus() {
  console.log('📊 ПОВНИЙ СТАТУС RSS + RETELL + TRANSLATE СИСТЕМИ\n');
  
  // Групування джобів за типом
  const jobsByType = {
    'rss': [],
    'retell': [], 
    'translate': [],
    'monitor': [],
    'maintenance': []
  };
  
  Object.entries(COMPLETE_CRON_JOBS).forEach(([id, job]) => {
    if (jobsByType[job.action]) {
      jobsByType[job.action].push({ id, ...job });
    }
  });
  
  // Показати по типам
  for (const [type, jobs] of Object.entries(jobsByType)) {
    if (jobs.length === 0) continue;
    
    console.log(`📋 ${type.toUpperCase()} ДЖОБИ (${jobs.length}):`);
    jobs.forEach(job => {
      const priority = job.priority === 'critical' ? '🔴' : job.priority === 'high' ? '🟠' : job.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${priority} ${job.id}: ${job.name} (${job.schedule})`);
      if (job.depends_on) {
        console.log(`      🔗 Залежності: ${job.depends_on.join(', ')}`);
      }
    });
    console.log('');
  }
  
  console.log('📈 СТАТИСТИКИ EDGE ФУНКЦІЙ:');
  
  // Спробувати отримати статистики (може не вдатися через мережу)
  const statsResult = await callEdgeFunction('fetch-rss', { action: 'get_cron_stats' });
  if (statsResult.success) {
    console.log(`   ✅ RSS статистики: OK`);
  } else {
    console.log(`   ⚠️ RSS статистики: недоступні (${statsResult.status})`);
  }
  
  console.log('\n💡 АРХІТЕКТУРА АВТОМАТИЗАЦІЇ:');
  console.log('   📡 RSS збір → 📝 Переказ → 🌍 Переклад → 🧹 Кеш cleanup');
  console.log('   ⏰ Періодичність: кожні 15-30 хвилин для RSS, 1-4 години для retell/translate');
  console.log('   🔗 Залежності: переклад чекає переказу, переказ чекає RSS збору');
}

async function showJobsByPriority() {
  console.log('\n⚡ ДЖОБИ ЗА ПРІОРИТЕТОМ:\n');
  
  const priorities = ['critical', 'high', 'medium', 'low'];
  
  priorities.forEach(priority => {
    const jobs = Object.entries(COMPLETE_CRON_JOBS).filter(([id, job]) => job.priority === priority);
    if (jobs.length === 0) return;
    
    const icon = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : priority === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} ${priority.toUpperCase()} (${jobs.length}):`);
    
    jobs.forEach(([id, job]) => {
      console.log(`   ⏰ ${job.schedule} - ${job.name}`);
    });
    console.log('');
  });
}

// CLI інтерфейс
async function main() {
  const command = process.argv[2];
  const jobId = process.argv[3];
  
  switch (command) {
    case 'run':
      if (jobId) {
        await runCronJob(jobId);
      } else {
        await runAllJobs();
      }
      break;
      
    case 'rss':
      await runJobsByType('rss');
      break;
      
    case 'retell':
      await runJobsByType('retell');
      break;
      
    case 'translate':
      await runJobsByType('translate');
      break;
      
    case 'monitor':
      await runJobsByType('monitor');
      break;

    case 'events':
      await fetchAndShowRecentRetellStats();
      break;
      
    case 'status':
      await showComprehensiveStatus();
      break;
      
    case 'priority': 
      await showJobsByPriority();
      break;
      
    case 'list':
      console.log('📋 Усі доступні cron джоби:\n');
      Object.entries(COMPLETE_CRON_JOBS).forEach(([id, job]) => {
        console.log(`   ${id}: ${job.name} [${job.action}]`);
      });
      break;
      
    default:
      console.log(`
📋 ПОВНА RSS + RETELL + TRANSLATE АВТОМАТИЗАЦІЯ

Використання:
  node manage-complete-cron.mjs <команда> [параметри]

Команди:
  status                    - Повний статус всіх систем 
  run [job_id]             - Запустити конкретний джоб або всі
  rss                      - Запустити тільки RSS збір  
  retell                   - Запустити тільки переказ новин
  translate                - Запустити тільки переклади
  monitor                  - Запустити моніторинг
  priority                 - Показати джоби за пріоритетом
  list                     - Список усіх джобів

Приклади:
  node manage-complete-cron.mjs status
  node manage-complete-cron.mjs run fetch_usa
  node manage-complete-cron.mjs rss  
  node manage-complete-cron.mjs retell
  node manage-complete-cron.mjs translate

Типи джобів: ${Object.keys(COMPLETE_CRON_JOBS).length} джобів загалом
- RSS збір: 5 джобів  
- Переказ: 3 джоби
- Переклад: 4 джоби
- Моніторинг: 3 джоби
      `);
      break;
  }
}

// Запустити CLI
main().catch(error => {
  console.error('❌ Помилка:', error.message);
  process.exit(1);
});