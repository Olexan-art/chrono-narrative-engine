# Memory: features/virality-simulation-system
Updated: now

## News Voting System

Each news article now has Like/Dislike functionality:
- **Database**: `news_rss_items` table extended with `likes`, `dislikes`, `viral_simulation_started_at`, `viral_simulation_completed`
- **Votes table**: `news_votes` stores individual votes with visitor_id (RLS enforced)
- **Component**: `NewsVoteBlock` displays voting buttons + textual labels ("Більшості подобається", "Більшість проти", "Приблизно порівну")
- Animated pulse icon for majority-likes state

## Virality Simulation (NHPP + STEPPS)

Automatic simulation of viral engagement using:

### STEPPS Model (Jonah Berger)
Scores news for virality potential based on:
- **S**ocial Currency: exclusive/insider knowledge
- **T**riggers: topical relevance (politics, tech, health)
- **E**motion: high-arousal emotions (shocking, scandal)
- **P**ractical Value: useful info (how-to, tips)
- **S**tories: narrative elements

### NHPP (Non-Homogeneous Poisson Process)
Generates realistic temporal distribution:
- **Delay phase**: 1-6 hours after publication (no activity)
- **Growth phase**: Exponential rise over 6-72 hours
- **Decay phase**: Exponential decay over 12-168 hours
- Interactions distributed with Poisson random generator

### Admin Panel
`ViralityPanel` in admin provides:
- Statistics: top voted news and outrage ink images
- Settings: all NHPP parameters (delay, growth, decay, min/max interactions, dislike ratio)
- Manual trigger: run simulation for all or specific news item

### Edge Function
`viral-simulation` can be triggered via cron or manually.

## Settings (in `settings` table)
- `viral_simulation_enabled`: boolean
- `viral_news_per_day`: number of news to simulate per day (STEPPS selection)
- `viral_delay_hours`, `viral_growth_hours`, `viral_decay_hours`: timing
- `viral_min_interactions`, `viral_max_interactions`: count range
- `viral_dislike_ratio`: proportion of dislikes (10-30% realistic)
