# Застосування SQL Міграції для LLM Cron Jobs

## ✅ Що вже зроблено:
1. ✅ Створено SQL міграцію `20260307010000_multi_llm_scoring_crons.sql`
2. ✅ Оновлено dashboard з розкладом LLM провайдерів
3. ✅ Виправлено bug в Edge Function (actualNewsId fix)
4. ✅ Задеплоєно Edge Function score-news-source
5. ✅ Протестовано всі провайдери (Z.AI, Gemini, DeepSeek, OpenAI) - працюють
6. ✅ Оновлено назви моделей (GLM-4.7-Flash, gemini-2.5-flash)

## ⏳ Залишилось застосувати SQL міграцію вручну:

### Крок 1: Відкрити Supabase Dashboard
1. Перейти на https://supabase.com/dashboard/project/tuledxqigzufkecztnlo
2. В лівому меню вибрати **SQL Editor**

### Крок 2: Створити новий Query
1. Натиснути кнопку **New query**
2. Скопіювати вміст файлу `supabase/migrations/20260307010000_multi_llm_scoring_crons.sql`
3. Вставити в SQL Editor

### Крок 3: Виконати Міграцію
1. Натиснути **Run** для виконання SQL
2. Перевірити що всі 3 команди виконались успішно

### Крок 4: Перевірити що Cron Jobs створені
Виконати перевірочний запит:
```sql
SELECT 
  jobname, 
  schedule, 
  active
FROM cron.job 
WHERE jobname IN (
  'invoke_source_scoring_zai_30min',
  'invoke_source_scoring_gemini_hourly',
  'invoke_source_scoring_openai_3h'
);
```

Очікуваний результат:
| jobname | schedule | active |
|---------|----------|--------|
| invoke_source_scoring_zai_30min | 0,30 * * * * | true |
| invoke_source_scoring_gemini_hourly | 15 * * * * | true |
| invoke_source_scoring_openai_3h | 0 */3 * * * | true |

## 📋 Розклад LLM Cron Jobs:

- **Z.AI (GLM-4.7-Flash)**: Кожні 30 хвилин (00, 30)
- **Gemini (gemini-2.5-flash)**: Щогодини о :15  
- **DeepSeek (deepseek-chat)**: Щогодини о :30 (вже існує)
- **OpenAI (gpt-4o-mini)**: Кожні 3 години (0, 3, 6, 9, 12, 15, 18, 21)

## ✅ Результати Тестування:

### Z.AI
- Test 1: ✅ Score 82, Status: Verified
- Test 2: ✅ Score 88, Status: Verified
- Rate limit досягнуто після успішних тестів

### Gemini  
- Test 1: ✅ Score 92, Status: Verified
- Test 2: ✅ Score 42, Status: Unverified

### DeepSeek
- Test 1: ✅ Score 71, Status: Partially Verified

### OpenAI
- Очікує виконання (DeepSeek rate limit)

**Висновок**: Всі провайдери працюють коректно з auto_select режимом ✅

## 🔍 Моніторинг після застосування:

1. Перевірити логи виконання:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname IN (
  'invoke_source_scoring_zai_30min',
  'invoke_source_scoring_gemini_hourly', 
  'invoke_source_scoring_openai_3h'
)
ORDER BY start_time DESC 
LIMIT 20;
```

2. Перевірити що source_scoring заповнюється:
```sql
SELECT 
  id, 
  title,
  source_scoring->'json'->'verification_score'->>'overall' as score,
  source_scoring->'json'->>'verification_status' as status,
  llm_processed_at
FROM news_rss_items 
WHERE source_scoring IS NOT NULL
ORDER BY llm_processed_at DESC
LIMIT 10;
```

3. Переглянути dashboard на https://bravennow.com/admin
