# Bot SSR Configuration Guide

Цей документ описує налаштування та використання Server-Side Rendering (SSR) для ботів та LLM на BravenNow.

## Проблема

Боти та LLM (GPT, Claude, Perplexity тощо) бачать повідомлення "This website requires JavaScript..." замість реального контенту сторінок wiki сутностей та інших сторінок.

## Рішення

Реалізовано багаторівневу систему SSR:

### 1. Netlify Edge Function (`netlify/edge-functions/bot-ssr.ts`)
- Виявляє ботів за User-Agent
- Для ботів викликає Supabase Edge Function для генерації SSR контенту
- Підтримує wiki сторінки: `/wiki/{slug}` або `/wiki/{uuid}`

### 2. Supabase Edge Function (`supabase/functions/ssr-render/index.ts`)
- Генерує повний HTML з усім контентом для ботів
- Включає метадані, structured data, повний контент статей
- Підтримує всі типи сторінок: wiki, news, chapters, volumes тощо

### 3. Cloudflare Worker (`cloudflare-worker.js`)
- **КРИТИЧНО**: Виявляє ботів та обходить Cloudflare кеш для HTML сторінок
- Це гарантує що боти завжди отримують свіжий SSR контент від Netlify
- Без цього боти можуть отримувати закешований порожній `index.html`

## Зміни в цьому оновленні

1. **Покращено паттерн wiki** в `bot-ssr.ts`:
   - Було: `/^\/wiki\/[a-z0-9-]+$/` (лише малі літери)
   - Стало: `/^\/wiki\/[a-zA-Z0-9-]+$/i` (підтримка великих літер в UUID)

2. **Оновлено Cloudflare Worker**:
   - Додано виявлення ботів (БЕЗ викликів до trace)
   - Для ботів: повне обходження Cloudflare кешу на HTML маршрутах
   - Додано діагностичні заголовки: `X-Bot-Detected`, `X-CF-Cache-Status`

3. **Створено скрипти очистки кешу**:
   - `clear-cloudflare-cache.sh` (Linux/Mac)
   - `clear-cloudflare-cache.ps1` (Windows)

## Як використовувати

### Після деплою змін

1. **Деплой Cloudflare Worker**:
   ```bash
   # Використайте Cloudflare Dashboard або Wrangler CLI
   wrangler deploy cloudflare-worker.js
   ```

2. **Очистити Cloudflare кеш**:

   **Windows (PowerShell)**:
   ```powershell
   # Встановіть змінні оточення (один раз)
   $env:CF_ZONE_ID = "your_zone_id_here"
   $env:CF_API_TOKEN = "your_api_token_here"
   
   # Очистити весь кеш
   .\clear-cloudflare-cache.ps1
   
   # Очистити тільки wiki сторінки
   .\clear-cloudflare-cache.ps1 -Path "/wiki/*"
   ```

   **Linux/Mac (Bash)**:
   ```bash
   # Встановіть змінні оточення (один раз)
   export CF_ZONE_ID="your_zone_id_here"
   export CF_API_TOKEN="your_api_token_here"
   
   # Очистити весь кеш
   ./clear-cloudflare-cache.sh
   
   # Очистити тільки wiki сторінки
   ./clear-cloudflare-cache.sh "/wiki/*"
   ```

3. **Отримати Cloudflare credentials**:
   - Zone ID: Cloudflare Dashboard → ваш домен → Overview (праворуч внизу)
   - API Token: Cloudflare Dashboard → My Profile → API Tokens → Create Token
     - Використайте шаблон "Edit zone DNS" або створіть custom з правами `Cache Purge`

### Перевірка SSR для ботів

Використайте curl з User-Agent бота:

```bash
# Перевірити wiki сторінку
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
     -v https://bravennow.com/wiki/0974bc56-e85a-4145-bd65-8348a1ab2192

# Шукайте в заголовках:
# X-Bot-Detected: true
# X-CF-Cache-Status: BYPASS
# X-SSR-Bot: true
```

Також можна використати онлайн інструменти:
- Google Search Console → URL Inspection
- Rich Results Test: https://search.google.com/test/rich-results
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

## Список підтримуваних ботів

- **Пошукові**: Googlebot, Bingbot, Yandex, DuckDuckBot, Baidu
- **AI/LLM**: GPTBot, ChatGPT-User, ClaudeBot, Anthropic-AI, PerplexityBot, Cohere
- **Соціальні**: TwitterBot, FacebookExternalHit, LinkedInBot, TelegramBot
- **Інструменти**: Semrush, Ahrefs, Screaming Frog, Lighthouse

## Troubleshooting

### Боти все ще бачать "This website requires JavaScript"

1. Перевірте що Cloudflare Worker задеплоєний
2. Очистіть Cloudflare кеш (див. вище)
3. Перевірте що Netlify edge function активна (`netlify/edge-functions/manifest.json`)
4. Використайте curl з bot User-Agent для тестування

### Cloudflare Worker не виявляє ботів

- Перевірте `X-Bot-Detected` заголовок у відповіді
- Деякі боти можуть використовувати нестандартні User-Agents
- Додайте нові паттерни в `BOT_PATTERNS` масив

### SSR контент не оновлюється

1. Очистіть Supabase кеш: `./clear-cache.sh`
2. Очистіть Cloudflare кеш (див. скрипти вище)
3. Перевірте логи Supabase Edge Function

## Performance

- **Для звичайних користувачів**: без змін, SPA працює як раніше
- **Для ботів**: SSR генерується на льоту або з кешу Supabase
- **Cloudflare кеш**: обходиться для ботів, використовується для користувачів

## Корисні команди

```bash
# Деплой на Netlify
netlify deploy --prod

# Перевірка логів Supabase Edge Function
supabase functions logs ssr-render --project-ref tuledxqigzufkecztnlo

# Тест SSR локально (якщо налаштовано)
curl http://localhost:8888/wiki/test-slug -A "Googlebot"
```
