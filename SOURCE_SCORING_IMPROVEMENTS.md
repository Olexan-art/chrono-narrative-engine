# Source Scoring Improvements

## Зміни

### 1. Додано час створення скорінга (source_scoring_at)

**Міграція:** `supabase/migrations/20260308000000_add_source_scoring_timestamp.sql`

Додано нове поле `source_scoring_at TIMESTAMP WITH TIME ZONE` для точного визначення коли був створений скорінг.

**Edge Function:** `supabase/functions/score-news-source/index.ts`
- При створенні скорінга тепер встановлюється `source_scoring_at = now()`
- Додано логування cache refresh операцій

**Dashboard:** `src/pages/admin/AdminDashboardPage.tsx`
- У блоці "Останні 10 оцінок" додано відображення часу створення скорінга
- Формат: "⭐ Скорінг: дд.мм.рррр о гг:хх"
- Сортування за `source_scoring_at` замість `llm_processed_at`

### 2. Вибірка новин тільки з Deep Analyst

**Edge Function:** `supabase/functions/score-news-source/index.ts`

Додано детальний коментар який пояснює логіку вибору новин для скорінга:
- `content IS NOT NULL` - є український переказ
- `news_analysis IS NOT NULL` - є deep analysis від deep-analyst крону
- `source_scoring IS NULL` - ще немає скорінга
- Сортування за `llm_processed_at DESC` - найсвіжіші оброблені новини першими

### 3. Оновлення кешу після створення скорінга

**Edge Function:** `supabase/functions/score-news-source/index.ts`

Покращено логіку оновлення кешу:
- Додано детальне логування операцій
- Додана обробка помилок з виводом у console
- При створенні скорінга викликається `cache-pages?action=refresh-single`
- Це оновлює як саму сторінку новини, так і пов'язані хаби (news/COUNTRY, /news, /)
- Гарантує що пошукові боти бачать свіже скорінг

## Застосування

### 1. Застосувати міграцію

В Supabase Dashboard → SQL Editor виконати:

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

### 2. Перевірка міграції

```powershell
node check-scoring-settings.mjs
```

### 3. Деплой Edge Function

```powershell
supabase functions deploy score-news-source
```

### 4. Деплой Frontend

Frontend задеплоїться автоматично через Netlify (2-3 хвилини після push до main).

### 5. Тестування

1. Перевірити dashboard: https://bravennow.com/admin
2. У блоці "Останні 10 оцінок" має з'явитись час створення скорінга
3. Запустити тестовий скорінг вручну або почекати автоматичного крону

## Переваги

✅ Точне відстеження коли був створений кожен скорінг  
✅ Новини скоруються тільки після успішної обробки deep-analyst  
✅ Пошукові боти бачать свіжий скорінг одразу після створення  
✅ Покращена діагностика через детальне логування  
