# 🤖 Швидкий старт: SSR для ботів

## Що зроблено

✅ **Покращено підтримку wiki сторінок для ботів та LLM** (GPT, Claude, Perplexity тощо)

### Зміни:

1. **bot-ssr.ts** - розширено паттерн для wiki сторінок (підтримка UUID з великими літерами)
2. **cloudflare-worker.js** - додано виявлення ботів та обхід кешу для HTML сторінок
3. **Скрипти очистки кешу** - Bash і PowerShell версії

## Що треба зробити ЗАРАЗ

### 1. Деплой Cloudflare Worker

Оновіть Worker через Cloudflare Dashboard:
- Відкрийте: Cloudflare Dashboard → Workers & Pages → ваш worker
- Замініть код на вміст `cloudflare-worker.js`
- Збережіть та задеплойте

### 2. Очистіть Cloudflare кеш

**Windows PowerShell**:
```powershell
# Встановіть змінні (тільки перший раз)
$env:CF_ZONE_ID = "ваш_zone_id"
$env:CF_API_TOKEN = "ваш_api_token"

# Очистіть весь кеш
.\clear-cloudflare-cache.ps1
```

**Де взяти credentials**:
- Zone ID: Cloudflare Dashboard → Overview → Zone ID (праворуч)
- API Token: My Profile → API Tokens → Create Token (з правами Cache Purge)

### 3. Перевірте результат

Тест з curl (симуляція Google bot):
```bash
curl -A "Googlebot" https://bravennow.com/wiki/0974bc56-e85a-4145-bd65-8348a1ab2192
```

Або використайте:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Як це працює

```
БОТ → Cloudflare Worker (виявляє бота, обходить кеш)
      ↓
      Netlify Edge Function (bot-ssr.ts)
      ↓
      Supabase Edge Function (ssr-render)
      ↓
      БОТ ← Повний HTML з контентом
```

## Детальна документація

Див. [BOT-SSR-GUIDE.md](./BOT-SSR-GUIDE.md)

## Troubleshooting

**Проблема**: Боти все ще бачать "This website requires JavaScript"

**Рішення**:
1. ✅ Cloudflare Worker задеплоєний?
2. ✅ Cloudflare кеш очищений?
3. ✅ Перевірте curl з bot User-Agent

**Контакт**: Якщо проблеми залишаються, перевірте логи:
```bash
supabase functions logs ssr-render --project-ref tuledxqigzufkecztnlo
```
