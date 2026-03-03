# 🔧 Інструкції з налаштування RSS автоматизації

## Підсумок діагностики

✅ **Що працює:**
- RSS збір новин активний (10 нових за 6 годин)
- Edge функції працюють: `get_cron_stats`, `get_pending_stats`, `fetch_country`
- База країн налаштована з UUID для США, України та інших
- 10+ активних RSS джерел (Al Jazeera, BBC, Financial Times...)

❌ **Що потребує налаштування:**
- Відсутні автоматичні cron job конфігурації
- Немає колонки `news_rss_feeds.last_sync_at`
- Timeout помилки на великих статистичних запитах

## 🚀 Кроки для активації автоматизації

### 1. Налаштування бази даних

Виконати в **Supabase SQL Editor**:
```sql
-- Виконати файл setup-cron-jobs.sql
\i setup-cron-jobs.sql

-- Або скопіювати команди з файлу та виконати вручну
```

### 2. Активація GitHub Actions

```bash
# Закомітити і запушити файли автоматизації
git add .github/workflows/rss-automation.yml
git add setup-cron-jobs.sql  
git add manage-cron.mjs
git commit -m "feat: RSS автоматизація - cron джоби та GitHub Actions"
git push origin main
```

### 3. Ручне тестування

```bash
# Тестувати окремі cron джоби
node manage-cron.mjs list
node manage-cron.mjs status
node manage-cron.mjs run fetch_usa
node manage-cron.mjs run process_pending

# Запустити всі джоби
node manage-cron.mjs run
```

### 4. Моніторинг GitHub Actions

1. Відкрити GitHub → Actions tab проєкту
2. Перевірити чи створився workflow "RSS News Automation"
3. Ручний запуск: "Run workflow" → вибрати action
4. Перевірити логи виконання

### 5. Альтернативний зовнішній cron

Якщо GitHub Actions недоступний, використати **cron-job.org**:

1. Зареєструватися на https://cron-job.org
2. Створити джоби з URL:
   - `https://your-domain.com/api/cron/fetch-usa` (кожні 30 хв)
   - `https://your-domain.com/api/cron/process-pending` (кожні 15 хв)
   - `https://your-domain.com/api/cron/fetch-ukraine` (кожні 45 хв)

## 📊 Очікувані результати

Після налаштування ви отримаєте:

✅ **Автоматичний збір новин:**
- США: кожні 30 хвилин  
- Україна: кожні 45 хвилин
- Обробка pending: кожні 15 хвилин
- Статистики: кожні 2 години

✅ **Моніторинг та контроль:**
- Логи в GitHub Actions
- Статистики в cron_stats таблиці  
- Ручне управління через manage-cron.mjs

✅ **Покращення продуктивності:**
- Регулярний збір замість накопичення
- Автоматична обробка pending новин
- Контроль помилок та повториів

## 🏗️ Архітектура автоматизації

```
GitHub Actions (cron scheduler)
    ↓
RSS Edge Function (fetch-rss)
    ↓  
Database (news_rss_items, cron_stats)  
    ↓
Frontend (уже оптимізований з timeout)
```

## 🔍 Діагностичні команди

```bash  
# Перевірити стан системи
node manage-cron.mjs status

# Перевірити останні новини
node check-cron-jobs.mjs

# Тестувати RSS функції
node test-correct-actions.mjs
```

## 📈 Моніторинг ефективності

Після налаштування слідкувати за:
- Кількістю нових новин в годину
- Відсутністю timeout помилок на фронтенді  
- Регулярністю оновлень в cron_stats
- Балансом між fetch та process операціями

🎯 **Мета:** Забезпечити постійний потік свіжих новин без ручного втручання та без проблем з продуктивністю на фронтенді.