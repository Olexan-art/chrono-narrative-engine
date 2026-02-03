# Memory: technical/news/original-content-preservation
Updated: now

Для коректного переказу новин збережено оригінальний RSS контент у новому полі `original_content` таблиці `news_rss_items`. При імпорті з RSS-фідів оригінальний текст (content або description) записується в `original_content` і НЕ перезаписується при AI-переказі.

Логіка `retell-news` тепер перевіряє наявність `original_content` і використовує саме його для LLM-переказу замість поля `content_en` (яке перезаписується результатом переказу).

Порядок пріоритету для getContent():
1. `original_content` (якщо > 50 символів)
2. Локалізовані поля (content_hi, content_ta, тощо) для індійських новин
3. Fallback до description або content

Це забезпечує, що повторний переказ завжди використовує оригінальний текст джерела, а не попередній AI-переказ.
