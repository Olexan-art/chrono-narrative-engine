import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * STEPPS Model (Jonah Berger) scoring for virality prediction
 * - Social Currency: content that makes people look good
 * - Triggers: content associated with common triggers
 * - Emotion: high-arousal emotions (awe, anxiety, anger)
 * - Public: visible, easy to imitate
 * - Practical Value: useful information
 * - Stories: narrative-driven content
 */
function calculateSTEPPSScore(news: {
  title: string;
  content?: string;
  description?: string;
  category?: string;
  themes?: string[];
  keywords?: string[];
}): number {
  let score = 50; // Base score

  const text = `${news.title} ${news.description || ''} ${news.content || ''}`.toLowerCase();
  const keywords = news.keywords || [];
  const themes = news.themes || [];

  // Social Currency - exclusive/insider knowledge
  const socialCurrencyWords = ['exclusive', 'secret', 'insider', 'first', 'breaking', 'revealed', 'leaked'];
  score += socialCurrencyWords.filter(w => text.includes(w)).length * 5;

  // Triggers - topical relevance
  const triggerCategories = ['politics', 'technology', 'health', 'money', 'scandal'];
  if (news.category && triggerCategories.includes(news.category.toLowerCase())) {
    score += 10;
  }

  // Emotion - high-arousal emotions
  const emotionWords = [
    'shocking', 'outrage', 'amazing', 'incredible', 'disaster', 'crisis',
    'scandal', 'corruption', 'warning', 'urgent', 'шокуюче', 'скандал', 'криза'
  ];
  score += emotionWords.filter(w => text.includes(w)).length * 8;

  // Practical Value - useful info
  const practicalWords = ['how to', 'guide', 'tips', 'ways to', 'explained', 'як', 'поради'];
  score += practicalWords.filter(w => text.includes(w)).length * 5;

  // Stories - narrative elements
  const storyWords = ['story', 'journey', 'revealed', 'discovered', 'confession'];
  score += storyWords.filter(w => text.includes(w)).length * 4;

  // Boost for having rich metadata
  if (themes.length > 0) score += 5;
  if (keywords.length > 3) score += 5;

  // Cap the score
  return Math.min(100, Math.max(0, score));
}

/**
 * Non-Homogeneous Poisson Process (NHPP) intensity function
 * Models viral activity with delay, growth, and decay phases
 */
function nhppIntensity(
  hoursSincePublished: number,
  delayHours: number,
  growthHours: number,
  decayHours: number,
  peakIntensity: number
): number {
  // Before delay period - no activity
  if (hoursSincePublished < delayHours) {
    return 0;
  }

  const t = hoursSincePublished - delayHours;
  const growthEnd = growthHours;
  const decayStart = growthHours;
  const decayEnd = decayHours;

  // Growth phase (exponential rise)
  if (t < growthEnd) {
    const progress = t / growthEnd;
    return peakIntensity * (1 - Math.exp(-3 * progress));
  }

  // Decay phase (exponential decay)
  if (t < decayEnd) {
    const decayProgress = (t - decayStart) / (decayEnd - decayStart);
    return peakIntensity * Math.exp(-2 * decayProgress);
  }

  // After decay - minimal residual activity
  return peakIntensity * 0.02;
}

/**
 * Calculate how many interactions should happen in the current time window
 */
function calculateInteractionsForWindow(
  publishedAt: Date,
  settings: {
    viral_delay_hours: number;
    viral_growth_hours: number;
    viral_decay_hours: number;
    viral_min_interactions: number;
    viral_max_interactions: number;
    viral_dislike_ratio: number;
  },
  steppsScore: number
): { likes: number; dislikes: number } {
  const now = new Date();
  const hoursSincePublished = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
  
  // Scale total interactions by STEPPS score
  const scoreMultiplier = 0.5 + (steppsScore / 100);
  const totalTarget = Math.round(
    (settings.viral_min_interactions + 
    (settings.viral_max_interactions - settings.viral_min_interactions) * (steppsScore / 100)) 
    * scoreMultiplier
  );

  // Get intensity for current hour
  const intensity = nhppIntensity(
    hoursSincePublished,
    settings.viral_delay_hours,
    settings.viral_growth_hours,
    settings.viral_decay_hours,
    1.0
  );

  // Calculate interactions for this 6-hour window (assuming cron runs every 6h)
  const windowHours = 6;
  const avgIntensity = intensity;
  
  // Poisson-distributed count with rate = intensity * windowHours * scale
  const rate = avgIntensity * windowHours * (totalTarget / (settings.viral_decay_hours + settings.viral_growth_hours));
  const interactions = poissonRandom(rate);
  
  // Split into likes and dislikes
  const dislikes = Math.round(interactions * settings.viral_dislike_ratio);
  const likes = interactions - dislikes;
  
  return { likes, dislikes };
}

/**
 * Poisson random number generator
 */
function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  
  // For small lambda, use direct method
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    
    return k - 1;
  }
  
  // For larger lambda, use normal approximation
  const result = Math.round(lambda + Math.sqrt(lambda) * (Math.random() * 2 - 1) * 2);
  return Math.max(0, result);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, manual } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    const viralSettings = {
      viral_delay_hours: settings.viral_delay_hours || 1.5,
      viral_growth_hours: settings.viral_growth_hours || 24,
      viral_decay_hours: settings.viral_decay_hours || 48,
      viral_min_interactions: settings.viral_min_interactions || 50,
      viral_max_interactions: settings.viral_max_interactions || 300,
      viral_dislike_ratio: settings.viral_dislike_ratio || 0.15,
    };

    let newsToProcess: any[] = [];

    if (newsId) {
      // Manual mode - process specific news
      const { data: news } = await supabase
        .from('news_rss_items')
        .select('id, title, title_en, description, content, category, themes, keywords, published_at, likes, dislikes')
        .eq('id', newsId)
        .single();

      if (news) {
        newsToProcess = [news];
      }
    } else {
      // Auto mode - select news using STEPPS
      const { data: recentNews } = await supabase
        .from('news_rss_items')
        .select('id, title, title_en, description, content, category, themes, keywords, published_at, likes, dislikes, viral_simulation_completed')
        .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .eq('viral_simulation_completed', false)
        .order('published_at', { ascending: false })
        .limit(100);

      if (recentNews && recentNews.length > 0) {
        // Score each news with STEPPS
        const scoredNews = recentNews.map(news => ({
          ...news,
          steppsScore: calculateSTEPPSScore(news)
        }));

        // Sort by score and take top N
        scoredNews.sort((a, b) => b.steppsScore - a.steppsScore);
        newsToProcess = scoredNews.slice(0, settings.viral_news_per_day || 10);
      }
    }

    console.log(`Processing ${newsToProcess.length} news items for viral simulation`);

    let processed = 0;

    for (const news of newsToProcess) {
      const steppsScore = (news as any).steppsScore || calculateSTEPPSScore(news);
      const publishedAt = new Date(news.published_at || Date.now());
      
      const { likes: newLikes, dislikes: newDislikes } = calculateInteractionsForWindow(
        publishedAt,
        viralSettings,
        steppsScore
      );

      if (newLikes > 0 || newDislikes > 0) {
        // Update news item
        const { error } = await supabase
          .from('news_rss_items')
          .update({
            likes: (news.likes || 0) + newLikes,
            dislikes: (news.dislikes || 0) + newDislikes,
            viral_simulation_started_at: news.viral_simulation_started_at || new Date().toISOString(),
          })
          .eq('id', news.id);

        if (!error) {
          processed++;
          console.log(`News ${news.id}: +${newLikes} likes, +${newDislikes} dislikes (STEPPS: ${steppsScore})`);
        }
      }

      // Check if simulation should complete (after decay period)
      const hoursSincePublished = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSincePublished > viralSettings.viral_decay_hours + viralSettings.viral_growth_hours + viralSettings.viral_delay_hours) {
        await supabase
          .from('news_rss_items')
          .update({ viral_simulation_completed: true })
          .eq('id', news.id);
      }
    }

    // Also process outrage_ink images with similar logic
    const { data: recentInk } = await supabase
      .from('outrage_ink')
      .select('id, title, created_at, likes, dislikes, last_random_update, news_item:news_rss_items(title, themes, keywords)')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20);

    for (const ink of recentInk || []) {
      const newsData = (ink as any).news_item || {};
      const steppsScore = calculateSTEPPSScore({
        title: ink.title || newsData.title || '',
        themes: newsData.themes,
        keywords: newsData.keywords
      });

      const createdAt = new Date(ink.created_at);
      const { likes: newLikes, dislikes: newDislikes } = calculateInteractionsForWindow(
        createdAt,
        viralSettings,
        steppsScore * 0.7 // Images get slightly less engagement than news
      );

      if (newLikes > 0 || newDislikes > 0) {
        await supabase
          .from('outrage_ink')
          .update({
            likes: (ink.likes || 0) + newLikes,
            dislikes: (ink.dislikes || 0) + newDislikes,
            last_random_update: new Date().toISOString()
          })
          .eq('id', ink.id);
        
        processed++;
      }
    }

    // Update last run timestamp
    await supabase
      .from('settings')
      .update({ viral_last_run_at: new Date().toISOString() })
      .eq('id', settings.id);

    return new Response(
      JSON.stringify({ success: true, processed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Viral simulation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
