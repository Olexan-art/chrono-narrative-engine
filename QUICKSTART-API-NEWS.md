# 🚀 API News Integration - Quick Start

Швидкий гайд для запуску системи інтеграції API новин.

## 📦 Що вже створено?

✅ Edge Function: `supabase/functions/fetch-api-news/index.ts`  
✅ DB Migration: `supabase/migrations/20260310000000_add_api_news_fields.sql`  
✅ Admin UI: `src/components/admin/APINewsPanel.tsx`  
✅ Integration: `src/pages/admin/NewsProcessingPage.tsx` updated  

## ⚡ Швидкий Deploy (3 кроки)

### 1. Застосуйте міграцію БД

**Supabase Dashboard** → **SQL Editor** → **New Query**

Вставте SQL з файлу `supabase/migrations/20260310000000_add_api_news_fields.sql` і натисніть **Run**.

Або через CLI:
```bash
supabase db push
```

### 2. Задеплойте Edge Function

**Supabase Dashboard** → **Edge Functions** → **New Function** → Назва: `fetch-api-news`

Вставте код з `supabase/functions/fetch-api-news/index.ts` і натисніть **Deploy**.

Або через CLI:
```bash
supabase functions deploy fetch-api-news
```

### 3. Commit & Push

```bash
git add .
git commit -m "Add API news integration"
git push origin main
```

## 🧪 Тест

1. Відкрийте Admin → News Processing
2. Знайдіть секцію **API News Sources**
3. Виберіть TheNewsAPI, limit 10, натисніть Fetch
4. Перевірте: статті з'явились, час розподілений рівномірно

## 📖 Повна документація

- **API Integration Guide**: [API_NEWS_INTEGRATION.md](./API_NEWS_INTEGRATION.md)
- **Deployment Instructions**: [API_NEWS_INTEGRATION_DEPLOY.md](./API_NEWS_INTEGRATION_DEPLOY.md)

## 🔑 API Credentials

- **TheNewsAPI**: `ixQkl1K2hyeBRIFthJaXdXjFQx1tj5i7NCdkXWi6`
- **GNews**: `fdfcb34c470dc88fa0209cbdcece6255`

## 💡 Features

- 🕐 **24-hour distribution**: 100 статей рівномірно на 24 години
- 🚫 **Deduplication**: Автоматична перевірка дублікатів по URL
- 📊 **Real-time stats**: Статистика з auto-refresh кожні 30 секунд
- 🌍 **Dual API**: TheNewsAPI + GNews підтримка
- 🎨 **Bilingual UI**: Ukrainian/English

## ⚙️ Algorithm

```typescript
intervalMinutes = (24 * 60) / articleCount
publishTime[i] = startTime + (i * intervalMinutes * 60 * 1000)
```

**Приклад**: 100 статей → 1 стаття кожні ~14.4 хвилини

## 🎯 Next Steps

1. ✅ Deploy migration & edge function
2. ✅ Test with small limit (10 articles)
3. ✅ Run full fetch (100 articles)
4. ⏳ Setup cron for automated daily fetch
5. ⏳ Monitor API limits and costs

---

**Готово!** Ваша система готова до використання. Детальніше: [API_NEWS_INTEGRATION_DEPLOY.md](./API_NEWS_INTEGRATION_DEPLOY.md)
