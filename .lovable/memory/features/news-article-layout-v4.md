# Memory: features/news-article-layout-v4
Updated: now

News articles now feature an enhanced layout with three major improvements:

1. **Factual Lead Paragraph (5W)**: The retell-news edge function prompts have been updated to require the FIRST paragraph to answer the 5 journalism questions: WHO, WHAT, WHERE, WHEN, WHY. No filler text - pure facts only in the lead paragraph. This applies to all languages (UK, EN, PL).

2. **Related News by Entities**: A new `RelatedEntitiesNews` component displays up to 2 most recent news articles that share the same Wikipedia entities (people/companies) with the current article. Located in the sidebar below Wikipedia Entities section. Shows entity avatar badge and publication date.

3. **Entity Highlighted Content**: The `EntityHighlightedContent` component scans the news content text and highlights mentions of Wikipedia entities with:
   - Dotted underline in primary color
   - Hover tooltip showing entity image, name, description, extract preview
   - Direct Wikipedia link in tooltip
   - Supports multiple name variations (native name, English name, match term)

Components created:
- `src/components/RelatedEntitiesNews.tsx`
- `src/components/EntityHighlightedContent.tsx`
