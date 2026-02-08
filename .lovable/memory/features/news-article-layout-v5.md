# Memory: features/news-article-layout-v5
Updated: now

News articles layout updates:

1. **Entity Intersection Graph placement**: Moved from desktop sidebar to below article content on ALL screen sizes (same position for mobile and desktop). This provides consistent UX and better visibility of entity relationships.

2. **EntityLinkedContent fix**: The component now properly combines markdown parsing with entity linking. Previously it broke markdown formatting when linking entities. Now it:
   - Parses headers (#, ##, ###, ####)
   - Handles bold (**text**) and italic (*text*)
   - Renders lists (ul/ol) and blockquotes
   - Links entity mentions with tooltips inside all formatted elements
