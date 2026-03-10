import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TheNewsAPIArticle {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string;
  language: string;
  published_at: string;
  source: string;
  categories: string[];
}

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100) + '-' + Date.now();
}

// Distribute  items evenly over 24 hours
function distributePublishTimes(count: number, startTime: Date = new Date()): Date[] {
  const hoursInDay = 24;
  const intervalMinutes = (hoursInDay * 60) / count; // Distribute evenly
  
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    const publishTime = new Date(startTime.getTime() + (i * intervalMinutes * 60 * 1000));
    times.push(publishTime);
  }
  
  return times;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { source, limit = 100, country = 'us', language = 'en' } = await req.json();

    // TheNewsAPI integration
    if (source === 'thenewsapi') {
      const apiToken = 'ixQkl1K2hyeBRIFthJaXdXjFQx1tj5i7NCdkXWi6';
      const url = `https://api.thenewsapi.com/v1/news/all?api_token=${apiToken}&language=${language}&limit=${limit}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TheNewsAPI error: ${response.status}`);
      }

      const { data: articles } = await response.json();
      
      if (!articles || articles.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No articles found', inserted: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get US country ID
      const { data: usCountry } = await supabase
        .from('news_countries')
        .select('id')
        .eq('code', country)
        .single();

      if (!usCountry) {
        throw new Error(`Country ${country} not found`);
      }

      // Generate publish times distributed over 24 hours
      const publishTimes = distributePublishTimes(articles.length);
      
      let insertedCount = 0;
      const insertedIds: string[] = [];

      for (let i = 0; i < articles.length; i++) {
        const article: TheNewsAPIArticle = articles[i];
        
        // Check if article already exists by URL
        const { data: existing } = await supabase
          .from('news_rss_items')
          .select('id')
          .eq('url', article.url)
          .maybeSingle();

        if (existing) continue;

        const slug = generateSlug(article.title);
        const publishTime = publishTimes[i];

        const { data: inserted, error: insertError } = await supabase
          .from('news_rss_items')
          .insert({
            country_id: usCountry.id,
            external_id: article.uuid || article.url,
            title: article.title.slice(0, 500),
            title_en: article.title.slice(0, 500),
            description: article.description || article.snippet || '',
            description_en: article.description || article.snippet || '',
            content: article.snippet || article.description || '',
            content_en: article.snippet || article.description || '',
            original_content: article.snippet || article.description || '',
            url: article.url,
            slug: slug,
            image_url: article.image_url,
            category: article.categories?.[0] || 'general',
            published_at: article.published_at,
            scheduled_publish_at: publishTime.toISOString(), // Scheduled distribution
            fetched_at: new Date().toISOString(),
            source_type: 'api_thenewsapi'
          })
          .select('id')
          .single();

        if (!insertError && inserted) {
          insertedCount++;
          insertedIds.push(inserted.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          source: 'TheNewsAPI',
          total: articles.length,
          inserted: insertedCount,
          itemIds: insertedIds,
          message: `Fetched ${insertedCount} articles, distributed over 24 hours`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GNews integration
    if (source === 'gnews') {
      const apiKey = 'fdfcb34c470dc88fa0209cbdcece6255';
      const url = `https://gnews.io/api/v4/top-headlines?lang=${language}&max=${limit}&apikey=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GNews error: ${response.status}`);
      }

      const { articles } = await response.json();
      
      if (!articles || articles.length === 0) {
        return new Response(
          JSON.stringify({ success:true, message: 'No articles found', inserted: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get US country ID
      const { data: usCountry } = await supabase
        .from('news_countries')
        .select('id')
        .eq('code', country)
        .single();

      if (!usCountry) {
        throw new Error(`Country ${country} not found`);
      }

      // Generate publish times distributed over 24 hours
      const publishTimes = distributePublishTimes(articles.length);
      
      let insertedCount = 0;
      const insertedIds: string[] = [];

      for (let i = 0; i < articles.length; i++) {
        const article: GNewsArticle = articles[i];
        
        // Check if article already exists by URL
        const { data: existing } = await supabase
          .from('news_rss_items')
          .select('id')
          .eq('url', article.url)
          .maybeSingle();

        if (existing) continue;

        const slug = generateSlug(article.title);
        const publishTime = publishTimes[i];

        const { data: inserted, error: insertError } = await supabase
          .from('news_rss_items')
          .insert({
            country_id: usCountry.id,
            external_id: article.url,
            title: article.title.slice(0, 500),
            title_en: article.title.slice(0, 500),
            description: article.description || '',
            description_en: article.description || '',
            content: article.content || article.description || '',
            content_en: article.content || article.description || '',
            original_content: article.content || article.description || '',
            url: article.url,
            slug: slug,
            image_url: article.image,
            category: 'general',
            published_at: article.publishedAt,
            scheduled_publish_at: publishTime.toISOString(), // Scheduled distribution
            fetched_at: new Date().toISOString(),
            source_type: 'api_gnews'
          })
          .select('id')
          .single();

        if (!insertError && inserted) {
          insertedCount++;
          insertedIds.push(inserted.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          source: 'GNews',
          total: articles.length,
          inserted: insertedCount,
          itemIds: insertedIds,
          message: `Fetched ${insertedCount} articles, distributed over 24 hours`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: fetch from both sources
    if (!source || source === 'all') {
      // TheNewsAPI
      const theNewsUrl = `https://api.thenewsapi.com/v1/news/all?api_token=ixQkl1K2hyeBRIFthJaXdXjFQx1tj5i7NCdkXWi6&language=${language}&limit=50`;
      const theNewsResponse = await fetch(theNewsUrl);
      const theNewsData = theNewsResponse.ok ? await theNewsResponse.json() : { data: [] };

      // GNews
      const gNewsUrl = `https://gnews.io/api/v4/top-headlines?lang=${language}&max=50&apikey=fdfcb34c470dc88fa0209cbdcece6255`;
      const gNewsResponse = await fetch(gNewsUrl);
      const gNewsData = gNewsResponse.ok ? await gNewsResponse.json() : { articles: [] };

      const totalArticles = (theNewsData.data?.length || 0) + (gNewsData.articles?.length || 0);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Fetched from both sources',
          theNewsAPI: theNewsData.data?.length || 0,
          gNews: gNewsData.articles?.length || 0,
          total: totalArticles,
          hint: 'Use source parameter: "thenewsapi" or "gnews" to insert articles'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid source. Use: thenewsapi, gnews, or all' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
