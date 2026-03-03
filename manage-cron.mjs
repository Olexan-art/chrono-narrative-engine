#!/usr/bin/env node

/**
 * Система управління RSS Cron джобами для chrono-narrative-engine
 * Управляє автоматичним збором та обробкою RSS новин
 */

const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

// Конфігурація cron джобів
const CRON_JOBS = {
  'fetch_usa': {
    name: 'Збір новин США',
    schedule: '*/30 * * * *', // кожні 30 хвилин
    action: 'fetch_country',
    payload: { country_id: '1f57c11e-ab27-4e4e-b289-ca31dc80e895' }
  },
  'fetch_ukraine': {
    name: 'Збір новин України', 
    schedule: '*/45 * * * *', // кожні 45 хвилин
    action: 'fetch_country',
    payload: { country_id: 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11' }
  },
  'process_pending': {
    name: 'Обробка pending новин',
    schedule: '*/15 * * * *', // кожні 15 хвилин
    action: 'process_pending',
    payload: {}
  },
  'stats_check': {
    name: 'Перевірка статистик',
    schedule: '0 */2 * * *', // кожні 2 години
    action: 'get_cron_stats', 
    payload: {}
  }
};

async function callRSSFunction(action, payload = {}) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    });

    const result = await response.text();
    
    return {
      status: response.status,
      success: response.ok,
      data: result
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function runCronJob(jobId) {
  const job = CRON_JOBS[jobId];
  if (!job) {
    console.log(`❌ Невідомий cron джоб: ${jobId}`);
    return false;
  }

  console.log(`🚀 Запуск: ${job.name}`);
  console.log(`⏰ Розклад: ${job.schedule}`);
  console.log(`🔧 Action: ${job.action}`);
  
  const result = await callRSSFunction(job.action, job.payload);
  
  if (result.success) {
    console.log(`✅ ${job.name} - Успішно`);
    
    // Спробувати парсити результат
    try {
      const data = JSON.parse(result.data);
      if (data.success) {
        if (data.processed) console.log(`   📰 Оброблено: ${data.processed} новин`);
        if (data.fetched) console.log(`   📡 Отримано: ${data.fetched} новин`);
        if (data.results && data.results.length) console.log(`   📊 Результатів: ${data.results.length}`);
      } else if (data.error) {
        console.log(`   ⚠️ Повідомлення: ${data.error}`);
      }
    } catch (e) {
      console.log(`   📄 Відповідь: ${result.data.substring(0, 200)}...`);
    }
  } else {
    console.log(`❌ ${job.name} - Помилка (${result.status})`);
    if (result.error) console.log(`   🔍 Деталі: ${result.error}`);
    if (result.data) console.log(`   📄 Відповідь: ${result.data.substring(0, 200)}`);
  }
  
  return result.success;
}

async function runAllJobs() {
  console.log('🔄 Запуск усіх cron джобів...\n');
  
  const results = {};
  for (const [jobId, job] of Object.entries(CRON_JOBS)) {
    results[jobId] = await runCronJob(jobId);
    console.log(''); // розділювач
  }
  
  const successful = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`📊 Підсумок: ${successful}/${total} джобів успішно виконано`);
  return results;
}

async function showStatus() {
  console.log('📊 Статус RSS cron джобів\n');
  
  // Показати налаштовані джоби
  console.log('🛠️ Налаштовані джоби:');
  for (const [jobId, job] of Object.entries(CRON_JOBS)) {
    console.log(`   ${jobId}: ${job.name} (${job.schedule})`);
  }
  console.log('');
  
  // Отримати статистики
  console.log('📈 Статистики з fetch-rss:');
  const statsResult = await callRSSFunction('get_cron_stats');
  if (statsResult.success) {
    try {
      const stats = JSON.parse(statsResult.data);
      if (stats.success && stats.stats) {
        console.log(`   ✅ Отримано статистики (${statsResult.data.length} символів)`);
      } else {
        console.log(`   ⚠️ ${stats.error || 'Невідома помилка'}`);
      }
    } catch (e) {
      console.log(`   📄 Відповідь: ${statsResult.data.substring(0, 100)}...`);
    }
  } else {
    console.log(`   ❌ Помилка отримання статистик (${statsResult.status})`);
  }
  
  // Перевірити pending
  const pendingResult = await callRSSFunction('get_pending_stats');
  if (pendingResult.success) {
    try {
      const pending = JSON.parse(pendingResult.data);
      if (pending.success && pending.stats) {
        console.log(`   📋 Pending статистики: OK`);
      }
    } catch (e) {
      console.log(`   📋 Pending: ${pendingResult.data.substring(0, 100)}...`);
    }
  }
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
      
    case 'status':
      await showStatus();
      break;
      
    case 'list':
      console.log('📋 Доступні cron джоби:');
      for (const [id, job] of Object.entries(CRON_JOBS)) {
        console.log(`   ${id}: ${job.name}`);
      }
      break;
      
    default:
      console.log(`
📋 RSS Cron Job Manager

Використання:
  node manage-cron.mjs <команда> [параметри]

Команди:
  status                    - Показати статус джобів та статистики
  run [job_id]             - Запустити конкретний джоб або всі джоби  
  list                     - Показати список доступних джобів

Приклади:
  node manage-cron.mjs status
  node manage-cron.mjs run fetch_usa
  node manage-cron.mjs run
  node manage-cron.mjs list

Доступні джоби: ${Object.keys(CRON_JOBS).join(', ')}
      `);
      break;
  }
}

// Запустити CLI
main().catch(error => {
  console.error('❌ Помилка:', error.message);
  process.exit(1);
});