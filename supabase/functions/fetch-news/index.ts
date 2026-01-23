import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, categories } = await req.json();
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY');
    const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY');
    
    const allArticles: Array<{
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
    }> = [];

    // Fetch from NewsAPI
    if (NEWSAPI_KEY) {
      try {
        const newsApiQueries = [
          'technology AI',
          'science space',
          'climate change',
          'Ukraine',
          'USA politics'
        ];
        
        for (const query of newsApiQueries) {
          const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${dateStr}&sortBy=relevancy&pageSize=5&apiKey=${NEWSAPI_KEY}`;
          const response = await fetch(newsApiUrl);
          const data = await response.json();
          
          if (data.articles) {
            for (const article of data.articles as NewsArticle[]) {
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
      } catch (e) {
        console.error('NewsAPI error:', e);
      }
    }

    // Fetch from GNews
    if (GNEWS_API_KEY) {
      try {
        const topics = ['technology', 'science', 'world'];
        
        for (const topic of topics) {
          const gnewsUrl = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&max=5&apikey=${GNEWS_API_KEY}`;
          const response = await fetch(gnewsUrl);
          const data = await response.json();
          
          if (data.articles) {
            for (const article of data.articles as GNewsArticle[]) {
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
      } catch (e) {
        console.error('GNews error:', e);
      }
    }

    // Remove duplicates by URL
    const uniqueArticles = Array.from(
      new Map(allArticles.map(a => [a.url, a])).values()
    );

    console.log(`Fetched ${uniqueArticles.length} unique articles for ${dateStr}`);

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
