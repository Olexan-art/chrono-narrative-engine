# Memory: features/news/voting-system
Updated: now

News articles feature a visitor-based voting system (Like/Dislike) that hides raw counts from the public. Instead, it displays qualitative labels: 'Більшості подобається' (Majority likes) with an animated pulse icon, 'Більшість проти' (Majority against), or 'Приблизно порівну' (Approximately equal). Votes are tracked via 'x-visitor-id' headers and protected by RLS.

The homepage Outrage Ink section also uses qualitative vote indicators (no raw numbers), with animated icons for popular items.

Admin panel 'Віральність' tab includes external links to open news/caricatures in new tabs for quick access.
