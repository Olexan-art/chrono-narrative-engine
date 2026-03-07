# Checklist: Перевірка Source Scoring Improvements

## ✅ Статус Git
```
Коміт: af140ed
Статус: Успішно запушено в origin/main
```

## 📋 Кроки перевірки

### 1. Застосувати міграцію в Supabase

**Інструкція:**
1. Відкрити https://supabase.com/dashboard/project/vpdclswgfvqxlprqgmjt/sql
2. Вставити SQL:

```sql
-- Add source_scoring_at timestamp to track when source scoring was created
ALTER TABLE public.news_rss_items
ADD COLUMN IF NOT EXISTS source_scoring_at TIMESTAMP WITH TIME ZONE;

-- Add index for better performance when ordering by scoring time
CREATE INDEX IF NOT EXISTS idx_news_rss_items_source_scoring_at 
ON public.news_rss_items(source_scoring_at DESC);

-- Add comment
COMMENT ON COLUMN public.news_rss_items.source_scoring_at IS 'Timestamp when the source scoring was created/updated';
```

3. Натиснути RUN

**Очікуваний результат:**
```
Success. No rows returned
```

### 2. Перевірити Dashboard UI

**URL:** https://bravennow.com/admin

**Що перевірити:**
1. Блок "Останні 10 оцінок"
2. Має відображатись:
   - 📰 Новина: дд.мм.рррр о гг:хх
   - ⭐ Скорінг: дд.мм.рррр о гг:хх

**Для старих скорінгів:**
- Буде тільки "📰 Новина: ..." (це нормально)
- source_scoring_at буде NULL

**Для нових скорінгів:**
- Буде обидва рядки
- source_scoring_at автоматично заповниться

### 3. Перевірити Edge Function

**Netlify Deploy:**
- Frontend задеплоїться автоматично через 2-3 хвилини
- Перевірити: https://app.netlify.com/sites/[your-site]/deploys

**Supabase Function:**
```bash
supabase functions deploy score-news-source
```

### 4. Тестування нового скорінга

**Через Dashboard:**
1. Відкрити https://bravennow.com/admin
2. У блоці "Source Scoring" натиснути кнопку тесту
3. Після успіху перевірити що:
   - source_scoring_at заповнився
   - Cache оновився (перевірити сторінку новини)

**SQL перевірка:**
```sql
SELECT 
  title,
  source_scoring_at,
  llm_processed_at,
  (source_scoring->>'json')::jsonb->'scores'->>'overall' as score
FROM news_rss_items
WHERE source_scoring IS NOT NULL
ORDER BY source_scoring_at DESC NULLS LAST
LIMIT 10;
```

### 5. Перевірка Cache Purge

**Після створення скорінга:**
1. Перевірити Supabase Logs для Edge Function
2. Має бути запис:
   ```
   Refreshing cache for: /news/us/[slug]
   Cache refresh successful: {...}
   ```

3. Відкрити сторінку новини як бот:
   ```bash
   curl -A "Googlebot" https://bravennow.com/news/us/[slug]
   ```

4. Перевірити що source_scoring виводиться в HTML

## 📊 Очікувані результати

✅ Міграція застосована успішно  
✅ Dashboard показує час скорінга  
✅ Нові скорінги мають source_scoring_at  
✅ Cache оновлюється автоматично  
✅ Edge Function логує cache refresh  

## ⚠️ Можливі проблеми

**Проблема:** Dashboard не показує час скорінга
**Рішення:** 
- Перевірити що міграція застосована
- Очистити cache браузера
- Дочекатись Netlify deploy

**Проблема:** source_scoring_at = NULL для нових скорінгів
**Рішення:**
- Перевірити що Edge Function задеплоєна
- Переглянути Supabase Logs для помилок

**Проблема:** Cache не оновлюється
**Рішення:**
- Перевірити ADMIN_PASSWORD в env
- Переглянути логи Edge Function score-news-source
- Перевірити що cache-pages function працює

## 📝 Документація

Детальна інформація: [SOURCE_SCORING_IMPROVEMENTS.md](SOURCE_SCORING_IMPROVEMENTS.md)
