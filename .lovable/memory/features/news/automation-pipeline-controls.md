# Memory: features/news/automation-pipeline-controls
Updated: now

Генерація твітів та діалогів для новин повністю вимкнена:
1. **retell-news**: видалено виклик generate-dialogue, повертає лише контент, тези, теми, keywords
2. **fetch-rss**: autoDialogueEnabled та autoTweetsEnabled захардкоджені в false
3. **ssr-render**: видалено секції "What People Say" (tweets) та "Character Dialogue" з HTML
4. **NewsArticlePage.tsx**: видалено відображення NewsTweetCard та NewsDialogueSection, спрощено "Full Retelling" до тільки retell без соцконтенту

Налаштування в БД залишаються для можливого повторного включення:
- news_auto_dialogue_enabled: false
- news_auto_tweets_enabled: false

Адмін-кнопки генерації твітів/діалогів також приховані.
