#!/usr/bin/env node

/**
 * ТЕСТ ШВИДКОСТІ LLM ПРОВАЙДЕРІВ
 * Перевіряє час переказу 10 новин для ZAI GLM та DeepSeek
 */

const supabaseUrl = 'https://xvhlqxzudqmpsqrvzxfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGxxeHp1ZHFtcHNxcnZ6eGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDkzMDU5MTgsImV4cCI6MjAyNDg4MTkxOH0.SzPLgG3e8z3_xjxMvU6a8owU6zLhXj0L_lVYXwXbXl8';

async function testLLMSpeed(provider, model, batchSize, country) {
  console.log(`\n🧪 ТЕСТ: ${provider} (${model})`);
  console.log(`   📊 Batch: ${batchSize} новин`);
  console.log(`   🌍 Країна: ${country}`);
  
  const startTime = Date.now();
  
  try {
    const payload = {
      batch: true,
      country: country,
      limit: batchSize,
      model: model,
      provider: provider.toLowerCase(),
      test_mode: true // додати flag для тестування
    };
    
    console.log(`   ⏱️ Запуск... (${new Date().toLocaleTimeString()})`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(payload)
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    const result = await response.text();
    
    console.log(`   ⏱️ Завершено: ${duration.toFixed(2)} сек (${new Date().toLocaleTimeString()})`);
    console.log(`   📊 Швидкість: ${(batchSize / duration * 60).toFixed(1)} новин/хв`);
    console.log(`   🎯 Статус: ${response.status} ${response.ok ? '✅' : '❌'}`);
    
    if (!response.ok) {
      console.log(`   ⚠️ Помилка: ${result.substring(0, 200)}...`);
    } else {
      try {
        const output = JSON.parse(result);
        console.log(`   📝 Оброблено: ${output.processed || 'невідомо'} новин`);
      } catch (e) {
        console.log(`   📄 Відповідь: ${result.substring(0, 100)}...`);
      }
    }
    
    return {
      provider,
      model,
      batchSize,
      country,
      duration,
      speed: batchSize / duration * 60,
      status: response.status,
      success: response.ok
    };
    
  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`   ❌ Помилка: ${error.message}`);
    console.log(`   ⏱️ Час до помилки: ${duration.toFixed(2)} сек`);
    
    return {
      provider,
      model,
      batchSize,
      country,
      duration,
      speed: 0,
      status: 0,
      success: false,
      error: error.message
    };
  }
}

async function runSpeedTests() {
  console.log('🚀 ТЕСТУВАННЯ ШВИДКОСТІ LLM ПРОВАЙДЕРІВ\n');
  console.log('📋 Тестуємо переказ 10 новин для кожного провайдера...\n');

  const tests = [
    { provider: 'ZAI', model: 'GLM-4.7-Flash', batchSize: 10, country: 'usa' },
    { provider: 'DeepSeek', model: 'deepseek-chat', batchSize: 10, country: 'usa' },
    { provider: 'ZAI', model: 'GLM-4.7-Flash', batchSize: 10, country: 'ukraine' },
    { provider: 'DeepSeek', model: 'deepseek-chat', batchSize: 10, country: 'ukraine' }
  ];

  const results = [];

  for (const test of tests) {
    const result = await testLLMSpeed(test.provider, test.model, test.batchSize, test.country);
    results.push(result);
    
    // Пауза між тестами для уникнення перевантаження
    if (tests.indexOf(test) < tests.length - 1) {
      console.log('   ⏳ Пауза 10 сек...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 РЕЗУЛЬТАТИ ТЕСТУВАННЯ ШВИДКОСТІ');
  console.log('═'.repeat(80));

  console.log('\n🏆 ЗАГАЛЬНА СТАТИСТИКА:');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    const avgSpeed = successful.reduce((sum, r) => sum + r.speed, 0) / successful.length;
    const maxSpeed = Math.max(...successful.map(r => r.speed));
    const minSpeed = Math.min(...successful.map(r => r.speed));
    
    console.log(`   ⚡ Середня швидкість: ${avgSpeed.toFixed(1)} новин/хв`);
    console.log(`   🚀 Максимальна швидкість: ${maxSpeed.toFixed(1)} новин/хв`);
    console.log(`   🐌 Мінімальна швидкість: ${minSpeed.toFixed(1)} новин/хв`);
  }

  console.log('\n📋 ДЕТАЛЬНІ РЕЗУЛЬТАТИ:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${result.provider} (${result.country.toUpperCase()})`);
    console.log(`      ⏱️ Час: ${result.duration.toFixed(2)} сек`);
    console.log(`      ⚡ Швидкість: ${result.speed.toFixed(1)} новин/хв`);
    if (!result.success) {
      console.log(`      ❌ Помилка: ${result.error || 'HTTP ' + result.status}`);
    }
  });

  console.log('\n💡 РЕКОМЕНДАЦІЇ:');
  
  const zaiResults = successful.filter(r => r.provider === 'ZAI');
  const deepseekResults = successful.filter(r => r.provider === 'DeepSeek');
  
  if (zaiResults.length > 0) {
    const zaiAvg = zaiResults.reduce((sum, r) => sum + r.speed, 0) / zaiResults.length;
    console.log(`   🟡 ZAI GLM: ${zaiAvg.toFixed(1)} новин/хв (${(60/zaiAvg*10).toFixed(1)}с/10 новин)`);
  }
  
  if (deepseekResults.length > 0) {
    const deepseekAvg = deepseekResults.reduce((sum, r) => sum + r.speed, 0) / deepseekResults.length;
    console.log(`   🟣 DeepSeek: ${deepseekAvg.toFixed(1)} новин/хв (${(60/deepseekAvg*10).toFixed(1)}с/10 новин)`);
  }

  console.log('\n🔧 ОПТИМІЗАЦІЯ BATCH РОЗМІРІВ:');
  
  if (successful.length > 0) {
    const avgTimeFor10 = 60 / avgSpeed * 10;
    console.log(`   📏 Оптимальний batch для 10 новин: ${avgTimeFor10.toFixed(1)} секунд`);
    
    if (avgTimeFor10 < 30) {
      console.log('   ✅ Можна збільшити batch до 15-20 новин');
    } else if (avgTimeFor10 < 60) {
      console.log('   ⚠️ 10 новин - оптимальний розмір');
    } else {
      console.log('   🔻 Рекомендується зменшити batch до 5-8 новин');
    }
  }
}

// Запуск тестів
runSpeedTests().catch(console.error);