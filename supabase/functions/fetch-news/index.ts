import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NewsArticle {
  source: { name: string };
  title: string;
  description: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  content?: string;
}

interface GNewsArticle {
  source: { name: string; url: string };
  title: string;
  description: string;
  url: string;
  image?: string;
  publishedAt: string;
  content?: string;
}

interface ParsedArticle {
  external_id: string;
  source_name: string;
  source_url: string;
  title: string;
  description: string;
  content: string;
  url: string;
  image_url: string;
  published_at: string;
  category: string;
}

// RSS feeds - unlimited, no API key needed
const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News', category: 'world' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Technology', category: 'technology' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', category: 'science' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', category: 'world' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NY Times', category: 'world' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NY Times Tech', category: 'technology' },
  { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian', category: 'world' },
  { url: 'https://www.theguardian.com/uk/technology/rss', source: 'The Guardian Tech', category: 'technology' },
];

// Simple XML parser for RSS feeds
function parseRSSItem(itemXml: string, source: string, category: string, targetDate?: string): ParsedArticle | null {
  try {
    const getTagContent = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
      const match = itemXml.match(regex);
      return (match?.[1] || match?.[2] || '').trim();
    };

    const title = getTagContent('title');
    const link = getTagContent('link') || getTagContent('guid');
    const description = getTagContent('description');
    const pubDate = getTagContent('pubDate');
    
    // Parse and validate date
    const articleDate = pubDate ? new Date(pubDate) : null;
    
    // If target date is specified, filter by date
    if (targetDate && articleDate) {
      const articleDateStr = articleDate.toISOString().split('T')[0];
      if (articleDateStr !== targetDate) {
        return null; // Skip articles that don't match the target date
      }
    }
    
    // Try to get image from media:content or enclosure
    let imageUrl = '';
    const mediaMatch = itemXml.match(/url=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)/i);
    if (mediaMatch) {
      imageUrl = mediaMatch[1];
    }

    if (!title || !link) return null;

    return {
      external_id: `rss_${btoa(link).slice(0, 20)}`,
      source_name: source,
      source_url: link,
      title: title.replace(/<[^>]*>/g, ''), // Strip HTML tags
      description: description.replace(/<[^>]*>/g, '').slice(0, 500),
      content: description.replace(/<[^>]*>/g, ''),
      url: link,
      image_url: imageUrl,
      published_at: articleDate ? articleDate.toISOString() : new Date().toISOString(),
      category
    };
  } catch {
    return null;
  }
}

async function fetchRSSFeed(feedUrl: string, source: string, category: string, targetDate?: string): Promise<ParsedArticle[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' }
    });
    
    if (!response.ok) {
      console.log(`RSS ${source}: HTTP ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    
    // Extract items from RSS
    const items: ParsedArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    let count = 0;
    
    while ((match = itemRegex.exec(xml)) !== null && count < 30) { // Parse more to find matching dates
      const article = parseRSSItem(match[1], source, category, targetDate);
      if (article) {
        items.push(article);
        count++;
      }
    }
    
    console.log(`RSS ${source}: ${items.length} articles for date ${targetDate || 'any'}`);
    return items;
  } catch (e) {
    console.error(`RSS ${source} error:`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fromDate = weekAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY');
    const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY');
    
    const allArticles: ParsedArticle[] = [];

    console.log(`Fetching news: target=${dateStr}, from=${fromDate}, to=${toDate}`);
    console.log(`API keys: NewsAPI=${!!NEWSAPI_KEY}, GNews=${!!GNEWS_API_KEY}`);

    // 1. First try RSS feeds (always available, no limits)
    console.log(`Fetching RSS feeds for date: ${dateStr}...`);
    const rssPromises = RSS_FEEDS.map(feed => 
      fetchRSSFeed(feed.url, feed.source, feed.category, dateStr)
    );
    const rssResults = await Promise.all(rssPromises);
    for (const articles of rssResults) {
      allArticles.push(...articles);
    }
    console.log(`RSS total: ${allArticles.length} articles matching ${dateStr}`);

    // 2. Fetch from NewsAPI (if available and RSS didn't get enough)
    if (NEWSAPI_KEY && allArticles.length < 20) {
      try {
        const newsApiQueries = ['technology AI', 'science space', 'Ukraine'];
        
        for (const query of newsApiQueries) {
          // Use exact target date for NewsAPI
          const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${dateStr}&to=${dateStr}&sortBy=publishedAt&pageSize=10&apiKey=${NEWSAPI_KEY}`;
          const response = await fetch(newsApiUrl);
          const data = await response.json();
          
          console.log(`NewsAPI "${query}": status=${data.status}, articles=${data.articles?.length || 0} for ${dateStr}`);
          
          if (data.status === 'error') {
            console.error(`NewsAPI error: ${data.message}`);
            break; // Stop if rate limited
          }
          
          if (data.articles) {
            for (const article of data.articles as NewsArticle[]) {
              if (article.title && article.url && !article.title.includes('[Removed]')) {
                // Double-check date matches
                const articleDateStr = article.publishedAt ? article.publishedAt.split('T')[0] : '';
                if (articleDateStr === dateStr) {
                  allArticles.push({
                    external_id: `newsapi_${btoa(article.url).slice(0, 20)}`,
                    source_name: article.source?.name || 'Unknown',
                    source_url: article.url,
                    title: article.title || '',
                    description: article.description || '',
                    content: article.content || article.description || '',
                    url: article.url,
                    image_url: article.urlToImage || '',
                    published_at: article.publishedAt,
                    category: query.split(' ')[0].toLowerCase()
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('NewsAPI error:', e);
      }
    }

    // 3. Fetch from GNews (if available and need more)
    if (GNEWS_API_KEY && allArticles.length < 30) {
      try {
        const topics = ['technology', 'science', 'world'];
        
        for (const topic of topics) {
          const gnewsUrl = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&max=10&apikey=${GNEWS_API_KEY}`;
          const response = await fetch(gnewsUrl);
          const data = await response.json();
          
          console.log(`GNews "${topic}": articles=${data.articles?.length || 0}`);
          
          if (data.errors) {
            console.error(`GNews error: ${data.errors[0]}`);
            break; // Stop if rate limited
          }
          
          if (data.articles) {
            for (const article of data.articles as GNewsArticle[]) {
              if (article.title && article.url) {
                // Filter by target date
                const articleDateStr = article.publishedAt ? article.publishedAt.split('T')[0] : '';
                if (articleDateStr === dateStr) {
                  allArticles.push({
                    external_id: `gnews_${btoa(article.url).slice(0, 20)}`,
                    source_name: article.source?.name || 'Unknown',
                    source_url: article.source?.url || '',
                    title: article.title || '',
                    description: article.description || '',
                    content: article.content || article.description || '',
                    url: article.url,
                    image_url: article.image || '',
                    published_at: article.publishedAt,
                    category: topic
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('GNews error:', e);
      }
    }

    // Remove duplicates by URL
    const uniqueArticles = Array.from(
      new Map(allArticles.map(a => [a.url, a])).values()
    );

    console.log(`Total fetched: ${uniqueArticles.length} unique articles for ${dateStr}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        articles: uniqueArticles,
        date: dateStr,
        count: uniqueArticles.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
