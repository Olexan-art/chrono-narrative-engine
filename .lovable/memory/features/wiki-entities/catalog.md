# Memory: features/wiki-entities/catalog
Updated: now

Каталог Wiki (/wiki) — це центральний хаб сутностей з алфавітним фільтром (UK/EN), категоріями та пошуком. На головній сторінці виводяться блоки 'Топ за 72 години' та список, відсортований за останньою згадкою у новинах. Внизу сторінки розміщено розширений двомовний SEO-блок про взаємозв'язки між персонами, корпораціями та організаціями з JSON-LD структурованими даними (CollectionPage + BreadcrumbList). Всі посилання використовують SEO-friendly слаги. ТОП-500 сутностей автоматично додаються до сайтмапу та SSR-кешу.

## Кешування

Адмін-панель включає кнопку "Wiki + сутності" для оновлення:
- /wiki, /news, /news/us, /news/ua, /news/pl, /news/in
- Топ-500 wiki-сутностей за search_count

Крон автооновлення кешу (refresh-all) включає всі wiki-сторінки.

## JSON-LD Structured Data

WikiCatalogSeoContent компонент генерує:
- CollectionPage schema з описом каталогу
- BreadcrumbList для навігації
- Список about entities (Political Leaders, Corporations, Organizations)
