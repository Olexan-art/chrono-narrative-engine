# Memory: features/news-auto-generation-pipeline
Updated: now

When news items are automatically fetched from RSS feeds, the system can now generate full content (retelling, dialogues, and tweets) in a single automated pipeline. This is controlled by settings in the `settings` table:

1. **news_auto_retell_enabled** (boolean, default: true) - Auto-retell news in article's language
2. **news_auto_dialogue_enabled** (boolean, default: true) - Auto-generate character dialogues
3. **news_auto_tweets_enabled** (boolean, default: true) - Auto-generate pseudo-tweets
4. **news_retell_ratio** (integer, default: 1) - Process every Nth news item (1 = all, 5 = every 5th)
5. **news_dialogue_count** (integer, default: 7) - Number of dialogue messages to generate (5-10)
6. **news_tweet_count** (integer, default: 4) - Number of tweets to generate (3-6)

The CronJobsPanel in admin interface now includes:
- Toggle switches for each auto-generation feature (retell, dialogues, tweets)
- Dropdown to select processing ratio (all, every 2nd, 5th, or 10th)
- Dropdown to configure dialogue count (5-10 messages)
- Dropdown to configure tweet count (3-6 tweets)
- **24-hour statistics** showing counts of auto-generated content (retelling, dialogues, tweets)
- Real-time status showing current configuration
- Manual trigger button that reports all generated content counts

The fetch-rss edge function reads these settings and processes new news items sequentially:
1. Insert news item from RSS
2. If within ratio threshold, queue for processing
3. For each queued item: retell → generate dialogue with tweets → save to database

All content is generated in the article's detected language (based on country code: UA→uk, PL→pl, IN→hi, else→en).
