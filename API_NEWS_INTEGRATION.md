# API News Integration

Інтеграція зовнішніх API джерел новин з автоматичним розподілом публікацій на 24 години.

## Підключені API

### 1. TheNewsAPI (https://www.thenewsapi.com)
- **API Token**: `ixQkl1K2hyeBRIFthJaXdXjFQx1tj5i7NCdkXWi6`
- **Особливості**:
  - Мультимовна підтримка
  - Категоризація новин
  - Детальні метадані
  - UUID для кожної статті

### 2. GNews (https://gnews.io)
- **API Key**: `fdfcb34c470dc88fa0209cbdcece6255`
- **Особливості**:
  - Топові заголовки
  - Підтримка країн
  - Швидке оновлення
  - Повний контент статей

## Архітектура

### Edge Function: `fetch-api-news`

Локація: `supabase/functions/fetch-api-news/index.ts`

#### Параметри запиту:
```json
{
  "source": "thenewsapi" | "gnews" | "all",
  "limit": 100,
  "country": "us" | "ua" | "gb" | ...,
  "language": "en" | "uk" | "de" | ...
}
```

#### Відповідь:
```json
{
  "success": true,
  "source": "TheNewsAPI",
  "total": 100,
  "inserted": 95,
  "itemIds": ["id1", "id2", ...],
  "message": "Fetched 95 articles, distributed over 24 hours"
}
```

### Розподіл публікацій

Алгоритм розподіляє `N` статей рівномірно на 24 години:

```typescript
intervalMinutes = (24 * 60) / N
publishTime[i] = startTime + (i * intervalMinutes * 60 * 1000)
```

**Приклад**: 100 статей → 1 стаття кожні ~14.4 хвилини

### База даних

#### Додані поля в `news_rss_items`:

1. **scheduled_publish_at** (`timestamptz`)
   - Запланований час публікації
   - Використовується для поступового релізу
   - Індексується для швидкого пошуку

2. **source_type** (`text`)
   - Значення: `'rss'`, `'api_thenewsapi'`, `'api_gnews'`
   - За замовчуванням: `'rss'`
   - Індексується для фільтрації

#### Міграція:
```sql
ALTER TABLE news_rss_items 
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'rss';

CREATE INDEX idx_news_rss_items_scheduled_publish 
  ON news_rss_items(scheduled_publish_at);

CREATE INDEX idx_news_rss_items_source_type 
  ON news_rss_items(source_type);
```

## Використання

### 1. Через Supabase Dashboard

```sql
SELECT functions.fetch_api_news(
  source := 'thenewsapi',
  limit := 100,
  country := 'us',
  language := 'en'
);
```

### 2. Через Edge Function API

```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-api-news \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "thenewsapi",
    "limit": 100,
    "country": "us",
    "language": "en"
  }'
```

### 3. Через Admin UI

1. Відкрийте адмін-панель
2. Перейдіть в розділ «API News Sources»
3. Виберіть джерело (TheNewsAPI, GNews, або обидва)
4. Встановіть параметри:
   - Кількість статей (до 100)
   - Країна
   - Мова
5. Натисніть «Fetch News»

## Cron Автоматизація

### Рекомендований графік:

```typescript
// Щодня о 00:00 UTC
const cronConfig = {
  schedule: '0 0 * * *',
  sources: ['thenewsapi', 'gnews'],
  limit: 100,
  country: 'us',
  language: 'en'
};
```

### Приклад Node-Cron:

```javascript
import cron from 'node-cron';

// Кожен день о 00:00
cron.schedule('0 0 * * *', async () => {
  await fetch('https://your-project.supabase.co/functions/v1/fetch-api-news', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: 'thenewsapi',
      limit: 100,
      country: 'us',
      language: 'en'
    })
  });
});
```

## Моніторинг

### SQL-запити для статистики:

```sql
-- Кількість статей по джерелам
SELECT source_type, COUNT(*) as count
FROM news_rss_items
WHERE source_type IN ('api_thenewsapi', 'api_gnews')
GROUP BY source_type;

-- Заплановані публікації (наступні 24 години)
SELECT COUNT(*) as scheduled_count
FROM news_rss_items
WHERE scheduled_publish_at IS NOT NULL
  AND scheduled_publish_at >= NOW()
  AND scheduled_publish_at <= NOW() + INTERVAL '24 hours';

-- Розподіл публікацій по годинах
SELECT 
  DATE_TRUNC('hour', scheduled_publish_at) as hour,
  COUNT(*) as articles_per_hour
FROM news_rss_items
WHERE scheduled_publish_at >= NOW()
  AND scheduled_publish_at <= NOW() + INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

## Ліміти API

### TheNewsAPI:
- **Free tier**: 150 requests/month
- **Paid**: від $9.99/month
- Rate limit: залежить від тарифу

### GNews:
- **Free tier**: 100 requests/day
- **Paid**: від $9.99/month
- Rate limit: 10 req/sec

## Рекомендації

1. **Розподіл навантаження**:
   - TheNewsAPI для основного контенту
   - GNews для топових заголовків
   - Чергування джерел для диверсифікації

2. **Оптимальні налаштування**:
   - 100 статей = 24 години = 1 стаття кожні 14.4 хв
   - 50 статей = 1 стаття кожні 28.8 хв
   - 25 статей = 1 стаття кожні 57.6 хв

3. **Моніторинг**:
   - Перевіряйте ліміти API
   - Відстежуйте кількість заплановать публікацій
   - Аналізуйте розподіл по годинах

## Troubleshooting

### Помилка: "Country not found"
```sql
-- Додайте країну в базу
INSERT INTO news_countries (code, name, flag, is_active)
VALUES ('ua', 'Ukraine', '🇺🇦', true);
```

### Помилка: "API rate limit exceeded"
- Перевірте ліміти вашого тарифу
- Зменшіть параметр `limit`
- Збільшіть інтервал між запитами

### Дублікація статей
Система автоматично перевіряє URL перед вставкою:
```typescript
const { data: existing } = await supabase
  .from('news_rss_items')
  .select('id')
  .eq('url', article.url)
  .maybeSingle();

if (existing) continue;
```

## Підтримка

Документація API:
- TheNewsAPI: https://www.thenewsapi.com/documentation
- GNews: https://gnews.io/docs/v4

---

**Автори**: Chrono Narrative Engine Team  
**Дата створення**: 10 березня 2026  
**Версія**: 1.0.0
