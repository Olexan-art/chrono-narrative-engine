import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tuledxqigzufkeczt**o.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1bGVkeHFpZ3p1ZmtlY3p0bmxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg0NTI4OCwiZXhwIjoyMDg2NDIxMjg4fQ.wHlFsEnF5zVGhIaJBBShxrOY7TFmxBjafPzqNrBXOU4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugQueueSystem() {
  try {
    console.log('🔍 Перевіряємо стан queue системи...\n')
    
    //1. Перевірити cron jobs
    console.log('1. Перевіряємо cron jobs:')
    const { data: cronJobs, error: cronError } = await supabase
      .from('cron.job')
      .select('*')
      .ilike('jobname', '%retell%')
    
    if (cronError) {
      console.log('❌ Помилка при отриманні cron jobs:', cronError.message)
    } else {
      console.log('📅 Знайдено cron jobs:', cronJobs?.length || 0)
      cronJobs?.forEach(job => {
        console.log(`   - ${job.jobname}: ${job.schedule} (активний: ${job.active})`)
      })
    }
    
    // 2. Перевірити retell queue
    console.log('\n2. Перевіряємо retell queue:')
    const { data: queueItems, error: queueError } = await supabase
      .from('retell_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (queueError) {
      console.log('❌ Помилка при отриманні queue:', queueError.message)
    } else {
      console.log('📋 Елементів в черзі:', queueItems?.length || 0)
      queueItems?.forEach(item => {
        console.log(`   - ${item.news_id} (${item.provider}) - статус: ${item.status}, створено: ${item.created_at}`)
      })
    }
    
    // 3. Перевірити останні новини
    console.log('\n3. Перевіряємо останні новини:')
    const { data: recentNews, error: newsError } = await supabase
      .from('news_rss_items')
      .select('id, published_at, title')
      .order('published_at', { ascending: false })
      .limit(5)
    
    if (newsError) {
      console.log('❌ Помилка при отриманні новин:', newsError.message)
    } else {
      console.log('📰 Останні новини:', recentNews?.length || 0)
      recentNews?.forEach(news => {
        console.log(`   - ${news.id}: ${news.title?.substring(0, 60)}... (${news.published_at})`)
      })
    }
    
    // 4. Перевірити llm_usage_logs
    console.log('\n4. Перевіряємо LLM usage за останні 30 хвилин:')
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: llmLogs, error: llmError } = await supabase
      .from('llm_usage_logs')
      .select('id, created_at, provider, model, tokens_used')
      .gte('created_at', thirtyMinAgo)
      .order('created_at', { ascending: false })
    
    if (llmError) {
      console.log('❌ Помилка при отриманні LLM logs:', llmError.message)
    } else {
      console.log('🤖 LLM викликів за 30 хвилин:', llmLogs?.length || 0)
      llmLogs?.forEach(log => {
        console.log(`   - ${log.provider}/${log.model}: ${log.tokens_used} tokens (${log.created_at})`)
      })
    }
    
    // 5. Спробувати викликати admin API
    console.log('\n5. Тестуємо admin API:')
    try {
      const response = await fetch('https://tuledxqigzufkecztnlo.supabase.co/functions/v1/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ action: 'getRetellQueueStats' })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ Admin API відповідає:', JSON.stringify(result, null, 2))
      } else {
        console.log('❌ Admin API помилка:', response.status, await response.text())
      }
    } catch (apiError) {
      console.log('❌ Admin API недоступний:', apiError.message)
    }
    
  } catch (error) {
    console.error('💥 Критична помилка:', error.message)
  }
}

debugQueueSystem()