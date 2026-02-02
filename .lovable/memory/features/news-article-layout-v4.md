# Memory: features/news-article-layout-v4
Updated: now

News articles now feature an enhanced layout with these improvements:

1. **Factual Lead Paragraph (5W)**: The first paragraph follows the 5W journalism rule (WHO, WHAT, WHERE, WHEN, WHY) - generated via LLM prompts. Visually highlighted with accent border only (no background, no visible 5W labels).

2. **Breadcrumbs Structure**: News Digest > All Countries > Country > Article. All links use /news paths. BreadcrumbList JSON-LD schema included for SEO.

3. **Related News by Entities**: The `RelatedEntitiesNews` component displays up to 2 most recent news articles sharing same Wikipedia entities. Shown in sidebar on desktop AND below article content on mobile.

4. **Entity Highlighted Content**: The `EntityHighlightedContent` component highlights mentions of Wikipedia entities with dotted underline and hover tooltips showing entity metadata.

5. **Full Retelling Admin Block**: Replaced "Hype Tweet" with "Full Retelling" button that runs the complete pipeline: retell → tweets → dialogue in sequence. Includes **step-by-step progress indicator** showing current stage (Переказ/Твіти/Діалог) with spinning loader and green checkmarks for completed steps.

Components:
- `src/components/RelatedEntitiesNews.tsx`
- `src/components/EntityHighlightedContent.tsx`
