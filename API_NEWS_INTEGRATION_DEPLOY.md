# API News Integration - Deployment Instructions

## 📝 Огляд

Ця інструкція описує кроки для розгортання системи інтеграції API новин з TheNewsAPI та GNews.

## ⚙️ Передумови

- ✅ Створені всі необхідні файли:
  - `supabase/functions/fetch-api-news/index.ts` - Edge function
  - `supabase/migrations/20260310000000_add_api_news_fields.sql` - DB migration
  - `src/components/admin/APINewsPanel.tsx` - Admin UI component
  - `src/pages/admin/NewsProcessingPage.tsx` - Updated admin page

## 1️⃣ Застосування Database Migration

### Варіант A: Через Supabase Dashboard (рекомендовано)

1. Відкрийте **Supabase Dashboard**: https://supabase.com/dashboard
2. Виберіть ваш проект
3. Перейдіть у розділ **SQL Editor** (ліва панель)
4. Створіть новий query натиснувши **New Query**
5. Скопіюйте та вставте вміст файлу `supabase/migrations/20260310000000_add_api_news_fields.sql`
6. Натисніть **Run** або `Ctrl+Enter`
7. Переконайтеся, що запит виконався успішно (✓ Success)

### Варіант B: Через Supabase CLI (якщо встановлений)

```bash
# З кореневої директорії проекту
cd c:\Users\oleksandrtsyrkin\HRONOVS_new\chrono-narrative-engine

# Login to Supabase (якщо ще не залогінені)
supabase login

# Link до проекту (якщо ще не прив'язано)
supabase link --project-ref YOUR_PROJECT_REF

# Застосувати міграцію
supabase db push

# Або застосувати конкретну міграцію
supabase db push --include-all
```

### Перевірка міграції:

Виконайте в SQL Editor:

```sql
-- Перевірте, що нові колонки існують
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'news_rss_items' 
  AND column_name IN ('scheduled_publish_at', 'source_type');

-- Перевірте індекси
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'news_rss_items' 
  AND indexname LIKE '%scheduled%' OR indexname LIKE '%source_type%';
```

Очікуваний результат:
- `scheduled_publish_at` (timestamp with time zone, nullable)
- `source_type` (text, default 'rss')
- 2 індекси створені

---

## 2️⃣ Deploy Edge Function

### Варіант A: Через Supabase CLI

```bash
# З кореневої директорії проекту
cd c:\Users\oleksandrtsyrkin\HRONOVS_new\chrono-narrative-engine

# Deploy edge function
supabase functions deploy fetch-api-news

# Verify deployment
supabase functions list
```

### Варіант B: Через Supabase Dashboard

1. Відкрийте **Supabase Dashboard**
2. Перейдіть у розділ **Edge Functions** (ліва панель)
3. Натисніть **New Function**
4. Назва: `fetch-api-news`
5. Скопіюйте весь код з `supabase/functions/fetch-api-news/index.ts`
6. Вставте у редактор
7. Натисніть **Deploy**

### Перевірка Edge Function:

Виконайте тестовий запит:

```bash
# Через curl (замініть YOUR_PROJECT_URL та YOUR_ANON_KEY)
curl -X POST https://YOUR_PROJECT_URL.supabase.co/functions/v1/fetch-api-news \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "all",
    "limit": 5,
    "country": "us",
    "language": "en"
  }'
```

Або через Supabase Dashboard:
1. **Edge Functions** → `fetch-api-news` → **Invoke**
2. Request body:
```json
{
  "source": "all",
  "limit": 5,
  "country": "us",
  "language": "en"
}
```

Очікувана відповідь:
```json
{
  "success": true,
  "source": "Both APIs",
  "total": 10,
  "inserted": 8,
  "itemIds": ["id1", "id2", ...],
  "message": "Preview: fetched 5 from TheNewsAPI and 5 from GNews"
}
```

---

## 3️⃣ Commit і Push до GitHub

```bash
# Перевірте статус
git status

# Додайте всі нові файли
git add supabase/functions/fetch-api-news/index.ts
git add supabase/migrations/20260310000000_add_api_news_fields.sql
git add src/components/admin/APINewsPanel.tsx
git add src/pages/admin/NewsProcessingPage.tsx
git add API_NEWS_INTEGRATION.md
git add API_NEWS_INTEGRATION_DEPLOY.md

# Commit з детальним описом
git commit -m "Add API news integration with TheNewsAPI and GNews

Features:
- Create fetch-api-news edge function with 24-hour distribution algorithm
- Add scheduled_publish_at and source_type columns to news_rss_items
- Implement distributePublishTimes() for even spacing of 100 articles over 24h
- Create APINewsPanel admin UI with statistics and fetch controls
- Support TheNewsAPI (token: ixQkl1K2hyeBRIFthJaXdXjFQx1tj5i7NCdkXWi6)
- Support GNews (API key: fdfcb34c470dc88fa0209cbdcece6255)
- Add deduplication logic checking existing URLs before insert
- Display recent API news with scheduled times and source badges
- Auto-refresh statistics every 30 seconds

Technical Details:
- Distribution algorithm: intervalMinutes = (24 * 60) / articleCount
- Each article: publishTime = startTime + (index * intervalMinutes * 60000)
- Database indexes for scheduled_publish_at and source_type queries
- Bilingual UI support (Ukrainian/English)

Documentation:
- Complete API integration guide in API_NEWS_INTEGRATION.md
- Deployment instructions in API_NEWS_INTEGRATION_DEPLOY.md
- API documentation links: thenewsapi.com/documentation, gnews.io/docs"

# Push до GitHub
git push origin main
```

---

## 4️⃣ Тестування системи

### Крок 1: Перевірте Admin UI

1. Відкрийте адмін-панель: https://yourdomain.com/admin
2. Введіть пароль адміністратора
3. Перейдіть на сторінку **News Processing**
4. Знайдіть секцію **API News Sources**
5. Переконайтеся, що статистика показує 0 для всіх полів спочатку

### Крок 2: Тестовий запит (малий ліміт)

1. В UIAPINewsPanel:
   - Виберіть джерело: **TheNewsAPI**
   - Встановіть ліміт: **10**
   - Країна: **United States**
   - Мова: **English**
2. Натисніть **Fetch News from TheNewsAPI**
3. Почекайте response (5-10 секунд)
4. Переконайтеся, що:
   - ✅ Toast показує успіх: "Fetched X articles"
   - ✅ Статистика оновилася: TheNewsAPI count = ~10
   - ✅ Recent News показує нові статті з image preview
   - ✅ Scheduled times розподілені рівномірно

### Крок 3: Перевірте розподіл часу

Виконайте SQL query:

```sql
SELECT 
  id,
  title,
  scheduled_publish_at,
  source_type,
  fetched_at
FROM news_rss_items
WHERE source_type = 'api_thenewsapi'
ORDER BY scheduled_publish_at
LIMIT 10;
```

Переконайтеся:
- ✅ `scheduled_publish_at` НЕ NULL
- ✅ Часові інтервали між статтями рівномірні (~144 хвилин для 10 статей за 24 години)
- ✅ `source_type` = 'api_thenewsapi'

### Крок 4: Тестуйте GNews

Повторіть кроки 2-3, але виберіть джерело **GNews**.

Перевірте:
- ✅ Статистика: GNews count збільшився
- ✅ SQL: `source_type` = 'api_gnews'
- ✅ Розподіл часу працює коректно

### Крок 5: Тест "Both APIs"

1. Виберіть джерело: **Both APIs (Preview)**
2. Ліміт: **5**
3. Натисніть Fetch
4. Переконайтеся:
   - ✅ Response містить статті з обох джерел
   - ✅ Статистика оновилася для обох API
   - ✅ Total count = TheNewsAPI count + GNews count

---

## 5️⃣ Повний запуск (100 статей)

### Після успішних тестів:

1. Виберіть джерело: **TheNewsAPI**
2. Ліміт: **100**
3. Натисніть Fetch
4. Почекайте ~20-30 секунд (API може бути повільним)
5. Перевірте:
   - ✅ Response: "Fetched 100 articles, distributed over 24 hours"
   - ✅ Статистика: TheNewsAPI count ≈ 100+
   - ✅ Scheduled count ≈ кількість статей в майбутньому

### Перевірте розподіл 100 статей:

```sql
-- Розподіл по годинах
SELECT 
  DATE_TRUNC('hour', scheduled_publish_at) as hour,
  COUNT(*) as articles_per_hour
FROM news_rss_items
WHERE source_type = 'api_thenewsapi'
  AND scheduled_publish_at >= NOW()
GROUP BY hour
ORDER BY hour;
```

Очікуваний результат:
- ~4-5 статей на годину (100 статей / 24 години)
- Рівномірний розподіл без великих пропусків

---

## 6️⃣ Моніторинг та автоматизація

### A. Автоматичний fetch (опціонально)

Додайте cron job для регулярного fetch:

**Через Supabase Dashboard:**
1. **Database** → **Cron Jobs** → **Create**
2. Назва: `fetch-api-news-daily`
3. Schedule: `0 0 * * *` (щодня о 00:00 UTC)
4. SQL:
```sql
SELECT net.http_post(
  'https://YOUR_PROJECT_URL.supabase.co/functions/v1/fetch-api-news',
  '{"source": "thenewsapi", "limit": 100, "country": "us", "language": "en"}',
  headers => '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb
);
```

### B. Моніторинг API лімітів

**TheNewsAPI:**
- Free tier: 150 requests/month
- 100 статей щодня = ~3000 requests/month ❌ Over limit
- Рекомендація: Upgrade до Paid plan ($9.99/month) або зменшіть ліміт

**GNews:**
- Free tier: 100 requests/day
- 100 статей щодня = 100 requests/day ✅ OK for free tier
- Rate limit: 10 req/sec

Рекомендація: Використовуйте GNews для щоденних fetch (100 статей), TheNewsAPI для специфічних запитів.

---

## 7️⃣ Troubleshooting

### Помилка: "Country not found"

```sql
-- Додайте країну в базу
INSERT INTO news_countries (code, name, flag, is_active)
VALUES ('ua', 'Ukraine', '🇺🇦', true),
       ('pl', 'Poland', '🇵🇱', true)
ON CONFLICT (code) DO NOTHING;
```

### Помилка: "API rate limit exceeded"

- Перевірте API dashboard (TheNewsAPI або GNews)
- Зменшіть параметр `limit`
- Збільшіть інтервал між запитами
- Розгляньте upgrade тарифу

### Помилка: "duplicate key value violates unique constraint"

- Це нормально! Система автоматично пропускає дублікати
- Перевірте логи: inserted count < total count
- Дублікати не створюють проблем

### Edge Function timeout

- Збільшіть timeout у Supabase Dashboard
- Edge Functions → fetch-api-news → Settings → Timeout: 60 seconds
- Великі ліміти (100+) можуть потребувати більше часу

### Statistics не оновлюються

- Перевірте network requests у DevTools
- Переконайтеся, що міграція застосована
- Перевірте console на помилки TypeScript
- Спробуйте hard refresh: `Ctrl+Shift+R`

---

## ✅ Checklist успішного деплою

- [ ] Database migration застосована (колонки створені, індекси створені)
- [ ] Edge function задеплоєна (тестовий запит успішний)
- [ ] Admin UI відображається на NewsProcessingPage
- [ ] Статистика показує 0 для всіх API спочатку
- [ ] Тестовий fetch (10 статей) працює для TheNewsAPI
- [ ] Тестовий fetch (10 статей) працює для GNews
- [ ] Розподіл часу коректний (рівномірні інтервали)
- [ ] Recent News список показує статті з thumbnails
- [ ] Source badges відображають правильні джерела
- [ ] Повний fetch (100 статей) працює без помилок
- [ ] Deduplication працює (дублікати не створюються)
- [ ] Auto-refresh статистики працює (кожні 30 секунд)
- [ ] Всі зміни закоммічені та запушені в GitHub
- [ ] Netlify auto-deployment виконав білд успішно
- [ ] Документація оновлена (README, API_NEWS_INTEGRATION.md)

---

## 🎉 Готово!

Після виконання всіх кроків ваша система інтеграції API новин повністю функціональна:

- ✅ 100 статей щодня з premium API джерел
- ✅ Автоматичний розподіл публікацій на 24 години
- ✅ Відсутність дублікатів (URL-based деduplication)
- ✅ Реальний моніторинг через Admin UI
- ✅ Підтримка двох API: TheNewsAPI + GNews
- ✅ Гнучка конфігурація (країна, мова, ліміт)

**Наступні кроки:**
1. Налаштуйте cron автоматизацію для регулярного fetch
2. Моніторьте API ліміти та витрати
3. Розгляньте upgrade тарифів при необхідності
4. Додайте аналітику для відстеження performance

Успіхів! 🚀
