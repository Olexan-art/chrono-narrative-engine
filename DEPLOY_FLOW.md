# Deploy Flow Summary

Цей документ збирає короткий опис CI/CD workflow у цьому репозиторії (.github/workflows).

## Знайдені workflow

- `.github/workflows/netlify-deploy.yml` — Deploy to Netlify
  - Тригер: `push` на `main`, `workflow_dispatch`
  - Кроки: checkout → setup node → install (pnpm) → build → deploy через Netlify action
  - Секрети: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`

- `.github/workflows/post-deploy-warm.yml` — Deploy & Post-deploy Warm
  - Тригер: `push` на `main`, `workflow_dispatch`
  - Кроки: checkout → setup node → install wrangler → deploy Cloudflare Worker → purge cache → warm important pages (curl)
  - Секрети: `CLOUDFLARE_API_TOKEN`, `PURGE_SECRET`
  - Примітка: останній запуск інколи може провалюватись; перевірити логи для деталі.

- `.github/workflows/ci-smoke.yml` — CI Smoke
  - Тригер: `push` на `main`, `workflow_dispatch`, `schedule` (кожні 30 хв)
  - Кроки: checkout → setup node → install deps → build (non-blocking)

- `.github/workflows/auto-release-prod.yml` — Auto Release Production
  - Тригер: `push` на `main`, `workflow_dispatch` (має опцію `deploy_netlify`)
  - Кроки: checkout → setup python → pre-warm script (`scripts/release_prod.py`) → setup node → build → deploy to Netlify (via build hook or action) → purge Cloudflare cache → verify
  - Секрети/перемінні: `NETLIFY_BUILD_HOOK_URL`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `CF_ZONE_ID`, `CF_API_TOKEN`, `PROD_BASE_URL`

- `.github/workflows/validate-secrets.yml` — Validate Secrets
  - Тригер: `workflow_dispatch`, `push` на `main`
  - Кроки: перевіряє наявність критичних секретів у середовищі (NETLIFY, SUPABASE, CF)

- `.github/workflows/supabase-deploy.yml` — Deploy Supabase Functions
  - Тригер: `push` на `main` (тільки зміни в `supabase/functions/**`), `workflow_dispatch`
  - Кроки: checkout → setup node → install supabase cli → login (token) → deploy edge functions (`bulk-retell-news`, `admin`, `ssr-render`)
  - Секрети: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

- `.github/workflows/fallback-bulk-retell-us.yml` — (fallback task)
  - Може бути призначений для аварійного чи планового виконання пов’язаних функцій; див. файл для деталей.

## Де шукати логи та як перезапустити

- GitHub Actions UI: Перейти до репозиторію → Actions → вибрати потрібний workflow → переглянути run/steps. ✅
- За потреби перезапустити провалений run: у Actions вибрати `Re-run jobs` або скористатись `gh run rerun <run-id>`.

## Рекомендації

- Якщо хочеш, можу:
  - додати посилання на останні run‑логи у цей файл;
  - автоматизувати перезапуск провалених job’ів або оповістити у Slack/Teams;
  - прибрати/оновити посилання на `news-digest` також у `Header.tsx` та SSR шаблонах.

---
Автоматично згенеровано за запитом. Файл додано до репо для подальшого збереження.
