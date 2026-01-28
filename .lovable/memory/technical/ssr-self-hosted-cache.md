# Memory: technical/ssr-self-hosted-cache
Updated: now

The system uses a self-hosted caching architecture for Server-Side Rendering (SSR) to support search engine indexing without relying on external edge workers. Pre-rendered HTML pages are stored in the `cached_pages` database table. The `ssr-render` Edge Function checks this cache first, returning an `X-Cache: HIT` header for valid entries and `X-Cache: MISS` when falling back to real-time generation. A 24-hour TTL is applied to all cached content.

## Bot Cache Analytics

The `bot_visits` table now tracks `cache_status` (HIT/MISS) for every bot visit. The admin panel includes:
- **BotCacheAnalyticsPanel**: Dashboard with HIT/MISS ratio charts, time saved calculations, and top pages analysis
- **SSR Test Tool**: Test button in Cache HIT panel to simulate bot requests and verify SSR output including canonical tags, robots meta, and link count

## Known Issues (2026-01-28)

The `ssr-render` function has deployment issues - deploy reports success but function returns 404. This may be due to:
- Large file size (982 lines causing bundle timeout)
- Need to split into smaller modules (not supported in Edge Functions single-file constraint)

Workaround: Use the test button in admin panel which directly calls the Edge Function URL.
