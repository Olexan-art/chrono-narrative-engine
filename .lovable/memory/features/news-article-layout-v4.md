# Memory: features/news-article-layout-v4
Updated: now

News articles now feature an enhanced layout with these improvements:

1. **Factual Lead Paragraph (5W)**: The first paragraph follows the 5W journalism rule (WHO, WHAT, WHERE, WHEN, WHY) - generated via LLM prompts. Visually highlighted with accent border and subtle background (no visible 5W labels).

2. **Related News by Entities**: The `RelatedEntitiesNews` component displays up to 2 most recent news articles sharing same Wikipedia entities. Shown in sidebar on desktop AND below article content on mobile.

3. **Entity Highlighted Content**: The `EntityHighlightedContent` component highlights mentions of Wikipedia entities with dotted underline and hover tooltips showing entity metadata.

4. **Full Retelling Admin Block**: Replaced "Hype Tweet" with "Full Retelling" button that runs the complete pipeline: retell → tweets → dialogue in sequence.

Components:
- `src/components/RelatedEntitiesNews.tsx`
- `src/components/EntityHighlightedContent.tsx`
