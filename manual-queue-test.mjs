import { createClient } from '@supabase/supabase-js'

// Спробуємо через anon key замість service role
const supabaseUrl = 'https://tuledxqigzufkecztnlo.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDUyODgsImV4cCI6MjA4NjQyMTI4OH0.g0Q4tQkWLNV5vTNjKPEGcCVEUfn-rJsYGFmfRKMjRdE'

const supabase = createClient(supabaseUrl, anonKey)

async function manualTestRetell() {
  try {
    console.log('🎯 Ручний запуск queue системи...\n')
    
    // 1. Спробувати викликати admin API для ініціалізації черги
    console.log('1. Ініціалізуємо чергу...')
    const initResponse = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ 
        action: 'initRetellQueue',
        password: '1nuendo19071'
      })
    })
    
    if (initResponse.ok) {
      const initResult = await initResponse.json()
      console.log('✅ Черга ініціалізована:', initResult)
    } else {
      console.log('❌ Ініціалізація не вдалась:', await initResponse.text())
    }
    
    // 2. Затримка
    console.log('\n⏱️ Чекаємо 3 секунди...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 3. Обробити чергу  
    console.log('2. Обробляємо чергу...')
    const processResponse = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ 
        action: 'processRetellQueue',
        password: '1nuendo19071'
      })
    })
    
    if (processResponse.ok) {
      const processResult = await processResponse.json()
      console.log('✅ Черга оброблена:', processResult)
    } else {
      console.log('❌ Обробка не вдалась:', await processResponse.text())
    }
    
    // 4. Отримати статистики
    console.log('\n3. Отримуємо статистики...')
    const statsResponse = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/admin', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ 
        action: 'getRetellQueueStats',
        password: '1nuendo19071'
      })
    })
    
    if (statsResponse.ok) {
      const statsResult = await statsResponse.json()
      console.log('✅ Статистики:', JSON.stringify(statsResult, null, 2))
    } else {
      console.log('❌ Статистики недоступні:', await statsResponse.text())
    }
    
  } catch (error) {
    console.error('💥 Помилка:', error.message)
  }
}

manualTestRetell()