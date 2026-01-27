# Memory: technical/canonical-url-consistency

All canonical URLs across the site must use the production domain https://echoes2.com, not development domains (e.g., chrono-narrative-engine.lovable.app). This includes:

## Pages with Canonical URLs
- **Homepage** (`/`): https://echoes2.com/
- **Calendar** (`/calendar`): https://echoes2.com/calendar
- **Chapters** (`/chapters`): https://echoes2.com/chapters
- **Volumes** (`/volumes`): https://echoes2.com/volumes
- **News Digest** (`/news-digest`): https://echoes2.com/news-digest
- **HTML Sitemap** (`/sitemap`): https://echoes2.com/sitemap
- **Date Stories** (`/date/:date`): https://echoes2.com/date/{date}
- **Story Reading** (`/read/:date/:storyNumber`): https://echoes2.com/read/{date}/{storyNumber}
- **Chapter Pages** (`/chapter/:number`): https://echoes2.com/chapter/{number}
- **Volume Pages** (`/volume/:yearMonth`): https://echoes2.com/volume/{yearMonth}
- **News Articles** (`/news/:country/:slug`): https://echoes2.com/news/{country}/{slug}

## SEO Components
- All pages use `SEOHead` component with proper `canonicalUrl` prop
- JSON-LD schemas (Organization, Article, BreadcrumbList) use echoes2.com base URL
- Open Graph and Twitter meta tags use production URLs
- Hreflang tags support uk, en, pl, and x-default

## Edge Functions
- `sitemap` - generates XML sitemap with echoes2.com URLs
- `news-sitemap` - country-specific news sitemaps
- `ssr-render` - pre-rendered HTML for crawlers
- `llms-txt` - AI-friendly documentation

## Admin SEO Panel
A dedicated SEO Audit panel in the admin interface provides:
- Overall SEO score calculation
- Issue detection by category (Canonical, Description, Title, OG Image)
- Page-by-page analysis with auto-fix functionality
- AI-powered recommendations based on Google SEO Starter Guide
- Crawler accessibility checks (robots.txt, sitemap, SSR)
- Keywords are NOT flagged as errors (Google officially ignores meta keywords)

## HTML Sitemap
Public HTML sitemap available at /sitemap with links to all major content sections
