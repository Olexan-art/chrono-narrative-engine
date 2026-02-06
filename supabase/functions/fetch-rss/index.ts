import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Track inserted items per country+category for auto-retell
const insertedItemsTracker: Map<string, string[]> = new Map();

// Helper to trigger cache generation for a news page
async function autoCacheNewsPage(
  countryCode: string, 
  slug: string, 
  supabaseUrl: string
): Promise<void> {
  try {
    const path = `/news/${countryCode}/${slug}`;
    console.log(`Auto-caching news page: ${path}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(path)}&password=${Deno.env.get('ADMIN_PASSWORD')}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to auto-cache ${path}:`, response.status);
    } else {
      const result = await response.json();
      console.log(`Auto-cached ${path}: ${result.success ? 'OK' : result.error}`);
    }
  } catch (error) {
    console.error(`Error auto-caching news page:`, error);
  }
}

// Helper to call retell-news for an item
async function autoRetellNews(newsId: string, supabaseUrl: string): Promise<void> {
  try {
    console.log(`Auto-retelling news item: ${newsId}`);
    const response = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ newsId, model: 'google/gemini-3-flash-preview' })
    });
    
    if (!response.ok) {
      console.error(`Failed to auto-retell news ${newsId}:`, response.status);
    } else {
      console.log(`Successfully auto-retold news ${newsId}`);
    }
  } catch (error) {
    console.error(`Error auto-retelling news ${newsId}:`, error);
  }
}

// Helper to scrape full article content
async function scrapeArticleContent(url: string, supabaseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/scrape-news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      console.error(`Scrape failed for ${url}: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    if (result.success && result.data?.content) {
      return result.data.content.slice(0, 10000);
    }
    return null;
  } catch (error) {
    console.error(`Scrape error for ${url}:`, error);
    return null;
  }
}

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  'media:content'?: { url?: string };
}

function parseRSSDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

// Decode HTML entities in text
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/gi, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-fA-F0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
  // First decode HTML entities
  const decodedTitle = decodeHTMLEntities(title);
  
  return decodedTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .slice(0, 100) // Limit length
    + '-' + Date.now().toString(36); // Add unique suffix
}

function extractImageFromContent(content: string): string | null {
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

function parseXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  // Find all <item> or <entry> elements
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  const entryMatches = xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi);
  
  const allMatches = [...itemMatches, ...entryMatches];
  
  for (const match of allMatches) {
    const itemXml = match[1];
    
    // Extract title
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    
    // Extract link
    let link = '';
    const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    if (linkMatch) {
      link = linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    } else {
      // Try href attribute (Atom format)
      const hrefMatch = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (hrefMatch) {
        link = hrefMatch[1];
      }
    }
    
    // Extract description
    const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) ||
                      itemXml.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim().slice(0, 500) : '';
    
    // Extract content
    const contentMatch = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i) ||
                         itemXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i);
    const content = contentMatch ? contentMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim().slice(0, 2000) : '';
    
    // Extract pubDate
    const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                         itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
                         itemXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
    
    // Extract image
    let imageUrl = '';
    const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                       itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
                       itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i) ||
                       itemXml.match(/<enclosure[^>]+type=["']image[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) {
      imageUrl = mediaMatch[1];
    } else if (content || description) {
      const extracted = extractImageFromContent(content || description);
      if (extracted) imageUrl = extracted;
    }
    
    if (title && link) {
      items.push({
        title,
        link,
        description,
        content,
        pubDate,
        enclosure: { url: imageUrl }
      });
    }
  }
  
  return items;
}

async function validateRSSFeed(url: string): Promise<{ valid: boolean; error?: string; itemCount?: number }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    
    const xml = await response.text();
    
    if (!xml.includes('<rss') && !xml.includes('<feed') && !xml.includes('<channel')) {
      return { valid: false, error: 'Not a valid RSS/Atom feed' };
    }
    
    const items = parseXML(xml);
    return { valid: true, itemCount: items.length };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, feedId, feedUrl, countryId, limit = 10 } = body;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate RSS feed URL
    if (action === 'validate') {
      if (!feedUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed URL is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = await validateRSSFeed(feedUrl);
      return new Response(
        JSON.stringify({ success: result.valid, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate slugs for existing items that don't have one
    if (action === 'generate_slugs') {
      const { data: items } = await supabase
        .from('news_rss_items')
        .select('id, title')
        .is('slug', null)
        .limit(500);
      
      if (!items || items.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No items need slugs', updated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      let updatedCount = 0;
      for (const item of items) {
        const slug = generateSlug(item.title);
        const { error } = await supabase
          .from('news_rss_items')
          .update({ slug })
          .eq('id', item.id);
        
        if (!error) updatedCount++;
      }
      
      return new Response(
        JSON.stringify({ success: true, total: items.length, updated: updatedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check feed status - compare items in RSS vs our database by URL
    if (action === 'check_feed') {
      if (!feedId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feed, error: feedError } = await supabase
        .from('news_rss_feeds')
        .select('id, name, url')
        .eq('id', feedId)
        .single();
      
      if (feedError || !feed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get existing URLs from our database
      const { data: existingItems } = await supabase
        .from('news_rss_items')
        .select('url')
        .eq('feed_id', feedId);
      
      const existingUrls = new Set((existingItems || []).map(item => item.url));
      const dbCount = existingUrls.size;
      
      // Fetch items from RSS and check which are new
      try {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              feedName: feed.name,
              rssItemCount: 0,
              dbItemCount: dbCount,
              newItemCount: 0,
              canFetch: false,
              error: `HTTP ${response.status}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const xml = await response.text();
        const items = parseXML(xml);
        
        // Count actually new items (not in database)
        const newItems = items.filter(item => !existingUrls.has(item.link));
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            feedName: feed.name,
            rssItemCount: items.length,
            dbItemCount: dbCount,
            newItemCount: newItems.length,
            canFetch: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            feedName: feed.name,
            rssItemCount: 0,
            dbItemCount: dbCount,
            newItemCount: 0,
            canFetch: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch specific number of items from a feed
    if (action === 'fetch_feed_limited') {
      if (!feedId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feed, error: feedError } = await supabase
        .from('news_rss_feeds')
        .select('*, news_countries!inner(id, code)')
        .eq('id', feedId)
        .single();
      
      if (feedError || !feed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const xml = await response.text();
        const items = parseXML(xml);
        
        // Get existing URLs to check for actual new items
        const { data: existingItems } = await supabase
          .from('news_rss_items')
          .select('url')
          .eq('feed_id', feed.id);
        
        const existingUrls = new Set((existingItems || []).map(item => item.url));
        
        let insertedCount = 0;
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const countryCode = feed.news_countries?.code?.toLowerCase() || 'us';
        
        for (const item of items.slice(0, limit)) {
          // Skip if already exists
          if (existingUrls.has(item.link)) continue;
          
          const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
          const slug = generateSlug(item.title);
          
          // Store original RSS content for AI retelling
          const originalDescription = item.description ? decodeHTMLEntities(item.description).slice(0, 1000) : null;
          const rssContent = item.content ? decodeHTMLEntities(item.content).slice(0, 5000) : null;
          
          // Priority scraping: fetch full article content first
          let originalContent = rssContent || originalDescription;
          const scrapedContent = await scrapeArticleContent(item.link, supabaseUrl);
          if (scrapedContent && scrapedContent.length > (originalContent?.length || 0)) {
            originalContent = scrapedContent;
            console.log(`Scraped full content for ${item.link}: ${scrapedContent.length} chars`);
          }
          
          const { error: insertError } = await supabase
            .from('news_rss_items')
            .insert({
              feed_id: feed.id,
              country_id: feed.country_id,
              external_id: item.link,
              title: decodeHTMLEntities(item.title).slice(0, 500),
              title_en: decodeHTMLEntities(item.title).slice(0, 500),
              description: originalDescription,
              description_en: originalDescription,
              content: rssContent,
              content_en: rssContent,
              original_content: originalContent, // Store scraped/original for AI retelling
              url: item.link,
              slug: slug,
              image_url: item.enclosure?.url || null,
              category: feed.category,
              published_at: pubDate?.toISOString() || null,
              fetched_at: new Date().toISOString()
            });
          
          if (!insertError) {
            insertedCount++;
            existingUrls.add(item.link); // Track newly added
            
            // Auto-cache the newly inserted news page
            autoCacheNewsPage(countryCode, slug, supabaseUrl);
          }
        }
        
        await supabase
          .from('news_rss_feeds')
          .update({ 
            last_fetched_at: new Date().toISOString(),
            fetch_error: null
          })
          .eq('id', feed.id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            feedName: feed.name,
            itemsFound: items.length,
            itemsInserted: insertedCount,
            limit
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch items from a single feed
    if (action === 'fetch_feed') {
      if (!feedId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feed, error: feedError } = await supabase
        .from('news_rss_feeds')
        .select('*, news_countries!inner(id, code)')
        .eq('id', feedId)
        .single();
      
      if (feedError || !feed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Feed not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Fetching RSS feed: ${feed.name} (${feed.url})`);
      
      try {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const xml = await response.text();
        const items = parseXML(xml);
        
        console.log(`Parsed ${items.length} items from ${feed.name}`);
        
        // Get existing URLs to avoid duplicates
        const { data: existingItems } = await supabase
          .from('news_rss_items')
          .select('url')
          .eq('feed_id', feed.id);
        
        const existingUrls = new Set((existingItems || []).map(item => item.url));
        
        // Insert only new items into database
        let insertedCount = 0;
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const countryCode = feed.news_countries?.code?.toLowerCase() || 'us';
        
        for (const item of items.slice(0, 200)) { // Limit to 200 items per feed
          // Skip if already exists
          if (existingUrls.has(item.link)) continue;
          
          const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
          
          // Generate slug from title
          const slug = generateSlug(item.title);
          
          // Store original RSS content for AI retelling
          const originalDescription = item.description ? decodeHTMLEntities(item.description).slice(0, 1000) : null;
          const rssContent = item.content ? decodeHTMLEntities(item.content).slice(0, 5000) : null;
          
          // Priority scraping: fetch full article content first
          let originalContent = rssContent || originalDescription;
          const scrapedContent = await scrapeArticleContent(item.link, supabaseUrl);
          if (scrapedContent && scrapedContent.length > (originalContent?.length || 0)) {
            originalContent = scrapedContent;
            console.log(`Scraped full content for ${item.link}: ${scrapedContent.length} chars`);
          }
          
          const { error: insertError } = await supabase
            .from('news_rss_items')
            .insert({
              feed_id: feed.id,
              country_id: feed.country_id,
              external_id: item.link,
              title: decodeHTMLEntities(item.title).slice(0, 500),
              title_en: decodeHTMLEntities(item.title).slice(0, 500), // English is the default
              description: originalDescription,
              description_en: originalDescription,
              content: rssContent,
              content_en: rssContent,
              original_content: originalContent, // Store scraped/original for AI retelling
              url: item.link,
              image_url: item.enclosure?.url || null,
              category: feed.category,
              published_at: pubDate?.toISOString() || null,
              fetched_at: new Date().toISOString(),
              slug: slug
            });
          
          if (!insertError) {
            insertedCount++;
            existingUrls.add(item.link);
            
            // Auto-cache the newly inserted news page
            autoCacheNewsPage(countryCode, slug, supabaseUrl);
          }
        }
        
        // Update feed status
        await supabase
          .from('news_rss_feeds')
          .update({ 
            last_fetched_at: new Date().toISOString(),
            fetch_error: null
          })
          .eq('id', feed.id);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            feedName: feed.name,
            itemsFound: items.length,
            itemsInserted: insertedCount
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await supabase
          .from('news_rss_feeds')
          .update({ 
            last_fetched_at: new Date().toISOString(),
            fetch_error: errorMessage
          })
          .eq('id', feed.id);
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch all feeds for a country
    if (action === 'fetch_country') {
      if (!countryId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Country ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feeds, error: feedsError } = await supabase
        .from('news_rss_feeds')
        .select('id, name')
        .eq('country_id', countryId)
        .eq('is_active', true);
      
      if (feedsError) {
        return new Response(
          JSON.stringify({ success: false, error: feedsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const results = [];
      for (const feed of feeds || []) {
        // Recursively call this function for each feed
        const response = await fetch(req.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch_feed', feedId: feed.id })
        });
        const result = await response.json();
        results.push({ feedId: feed.id, feedName: feed.name, ...result });
      }
      
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ALL active feeds (for cron job) - with full content generation
    if (action === 'fetch_all') {
      const { data: feeds, error: feedsError } = await supabase
        .from('news_rss_feeds')
        .select('id, name, country_id, url, category')
        .eq('is_active', true);
      
      if (feedsError) {
        return new Response(
          JSON.stringify({ success: false, error: feedsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get auto-generation settings
      const { data: settings } = await supabase
        .from('settings')
        .select('news_auto_retell_enabled, news_auto_dialogue_enabled, news_auto_tweets_enabled, news_retell_ratio, news_dialogue_count, news_tweet_count')
        .limit(1)
        .single();
      
      // Get per-country retell ratios
      const { data: countriesWithRatio } = await supabase
        .from('news_countries')
        .select('id, code, retell_ratio')
        .eq('is_active', true);
      
      const countryRatioMap = new Map<string, number>();
      for (const c of countriesWithRatio || []) {
        countryRatioMap.set(c.id, c.retell_ratio ?? 100);
      }
      
      const autoRetellEnabled = settings?.news_auto_retell_enabled ?? true;
      const autoDialogueEnabled = settings?.news_auto_dialogue_enabled ?? true;
      const autoTweetsEnabled = settings?.news_auto_tweets_enabled ?? true;
      const globalRetellRatio = settings?.news_retell_ratio ?? 1; // Fallback if per-country not set
      const dialogueCount = settings?.news_dialogue_count ?? 7;
      const tweetCount = settings?.news_tweet_count ?? 4;
      
      console.log(`Fetching all ${feeds?.length || 0} active RSS feeds with settings: retell=${autoRetellEnabled}, dialogue=${autoDialogueEnabled}, tweets=${autoTweetsEnabled}`);
      
      // Track inserted items per country+category for auto-content generation
      const insertTracker: Map<string, { count: number; toProcess: Array<{ id: string; countryCode: string; slug: string }> }> = new Map();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      const results = [];
      for (const feed of feeds || []) {
        try {
          // Get country code for this feed
          const { data: countryData } = await supabase
            .from('news_countries')
            .select('code')
            .eq('id', feed.country_id)
            .single();
          
          const countryCode = countryData?.code || 'unknown';
          
          const response = await fetch(feed.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            await supabase
              .from('news_rss_feeds')
              .update({ fetch_error: `HTTP ${response.status}`, last_fetched_at: new Date().toISOString() })
              .eq('id', feed.id);
            results.push({ feedId: feed.id, feedName: feed.name, success: false, error: `HTTP ${response.status}` });
            continue;
          }
          
          const xml = await response.text();
          const items = parseXML(xml);
          
          // Get existing URLs to prevent duplicates
          const { data: existingItems } = await supabase
            .from('news_rss_items')
            .select('url')
            .eq('feed_id', feed.id);
          
          const existingUrls = new Set((existingItems || []).map(item => item.url));
          
          let insertedCount = 0;
          const category = feed.category || 'general';
          const trackerKey = `${countryCode}_${category}`;
          
          // Initialize tracker for this country+category if not exists
          if (!insertTracker.has(trackerKey)) {
            insertTracker.set(trackerKey, { count: 0, toProcess: [] });
          }
          
          for (const item of items.slice(0, 200)) {
            // Skip if already exists
            if (existingUrls.has(item.link)) continue;
            
            const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
            const slug = generateSlug(item.title);
            
            // Store original RSS content for AI retelling
            const originalDescription = item.description ? decodeHTMLEntities(item.description).slice(0, 1000) : null;
            const originalContent = item.content ? decodeHTMLEntities(item.content).slice(0, 5000) : null;
            
            // Insert new item
            const { data: insertedData, error: insertError } = await supabase
              .from('news_rss_items')
              .insert({
                feed_id: feed.id,
                country_id: feed.country_id,
                external_id: item.link,
                title: decodeHTMLEntities(item.title).slice(0, 500),
                title_en: decodeHTMLEntities(item.title).slice(0, 500),
                description: originalDescription,
                description_en: originalDescription,
                content: originalContent,
                content_en: originalContent,
                original_content: originalContent || originalDescription, // Store original for AI retelling
                url: item.link,
                slug: slug,
                image_url: item.enclosure?.url || null,
                category: feed.category,
                published_at: pubDate?.toISOString() || null,
                fetched_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (!insertError && insertedData) {
              insertedCount++;
              existingUrls.add(item.link); // Track newly added
              
              // Auto-cache the newly inserted news page
              autoCacheNewsPage(countryCode.toLowerCase(), slug, supabaseUrl);
              
              // Track for auto-processing based on per-country ratio
              const tracker = insertTracker.get(trackerKey)!;
              tracker.count++;
              
              // Get per-country retell ratio (percentage 1-100), fallback to global setting
              const countryRetellRatio = countryRatioMap.get(feed.country_id) ?? 100;
              const shouldProcess = Math.random() * 100 < countryRetellRatio;
              
              if (shouldProcess) {
                tracker.toProcess.push({ id: insertedData.id, countryCode, slug });
              }
            }
          }
          
          await supabase
            .from('news_rss_feeds')
            .update({ last_fetched_at: new Date().toISOString(), fetch_error: null })
            .eq('id', feed.id);
          
          results.push({ feedId: feed.id, feedName: feed.name, success: true, itemsInserted: insertedCount });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await supabase
            .from('news_rss_feeds')
            .update({ fetch_error: errorMessage, last_fetched_at: new Date().toISOString() })
            .eq('id', feed.id);
          results.push({ feedId: feed.id, feedName: feed.name, success: false, error: errorMessage });
        }
      }
      
      // Collect all items to process
      const allToProcess: Array<{ id: string; countryCode: string; slug: string }> = [];
      for (const tracker of insertTracker.values()) {
        allToProcess.push(...tracker.toProcess);
      }
      
      // Limit processing to avoid timeout (edge function has ~50s limit)
      // Each item takes ~2-5s for retelling, so limit to 20 items per run
      const MAX_ITEMS_PER_RUN = 20;
      const itemsToProcess = allToProcess.slice(0, MAX_ITEMS_PER_RUN);
      const skippedCount = Math.max(0, allToProcess.length - MAX_ITEMS_PER_RUN);
      
      console.log(`Processing queue: ${itemsToProcess.length} items (${skippedCount} skipped due to limit). Total candidates: ${allToProcess.length}`);
      
      let totalRetelled = 0;
      let totalDialogues = 0;
      let totalTweets = 0;
      
      // Process each item: retell -> dialogue -> tweets
      for (const item of itemsToProcess) {
        const newsId = item.id;
        const countryCode = item.countryCode;
        const slug = item.slug;
        
        // Detect language based on country
        const detectLang = () => {
          const code = countryCode.toLowerCase();
          if (code === 'ua') return 'uk';
          if (code === 'pl') return 'pl';
          if (code === 'in') return 'hi';
          return 'en';
        };
        const contentLanguage = detectLang();
        
        // Step 1: Retell
        if (autoRetellEnabled) {
          try {
            console.log(`Auto-retelling news item: ${newsId}`);
            const response = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({ newsId, model: 'google/gemini-3-flash-preview' })
            });
            
            if (response.ok) {
              totalRetelled++;
              console.log(`Successfully auto-retold news ${newsId}`);
              
              // Update cache after retelling completes
              autoCacheNewsPage(countryCode.toLowerCase(), slug, supabaseUrl);
            } else {
              console.error(`Failed to auto-retell news ${newsId}:`, response.status);
            }
          } catch (error) {
            console.error(`Error auto-retelling news ${newsId}:`, error);
          }
          await new Promise(r => setTimeout(r, 300));
        }
        
        // Step 2: Generate dialogue
        if (autoDialogueEnabled) {
          try {
            // Get article data for dialogue generation
            const { data: article } = await supabase
              .from('news_rss_items')
              .select('*, feed:news_rss_feeds(name)')
              .eq('id', newsId)
              .single();
            
            if (article) {
              console.log(`Generating dialogue for news item: ${newsId}`);
              const response = await fetch(`${supabaseUrl}/functions/v1/generate-dialogue`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  storyContext: `News article: ${article.title_en || article.title}\n\n${article.description_en || article.description || ''}\n\n${article.content_en || article.content || ''}`,
                  newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || 'general'}`,
                  messageCount: dialogueCount,
                  enableThreading: true,
                  threadProbability: 30,
                  contentLanguage,
                  generateTweets: autoTweetsEnabled,
                  tweetCount: tweetCount
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                const updateData: Record<string, unknown> = {};
                
                if (result.success && result.dialogue) {
                  updateData.chat_dialogue = result.dialogue;
                  totalDialogues++;
                }
                
                if (result.tweets) {
                  updateData.tweets = result.tweets;
                  totalTweets++;
                }
                
                if (Object.keys(updateData).length > 0) {
                  await supabase
                    .from('news_rss_items')
                    .update(updateData)
                    .eq('id', newsId);
                }
                
                console.log(`Successfully generated dialogue${autoTweetsEnabled ? ' and tweets' : ''} for ${newsId}`);
              } else {
                console.error(`Failed to generate dialogue for ${newsId}:`, response.status);
              }
            }
          } catch (error) {
            console.error(`Error generating dialogue for ${newsId}:`, error);
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }
      
      console.log(`Completed: ${results.length} feeds, ${itemsToProcess.length} processed (${skippedCount} skipped), ${totalRetelled} retelled, ${totalDialogues} dialogues, ${totalTweets} tweets`);
      
      // Ping search engines if new content was added
      if (itemsToProcess.length > 0) {
        try {
          console.log('Pinging search engines about new content...');
          const pingResponse = await fetch(`${supabaseUrl}/functions/v1/ping-sitemap`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({})
          });
          
          if (pingResponse.ok) {
            const pingResult = await pingResponse.json();
            console.log('Search engine ping result:', pingResult);
          } else {
            console.error('Failed to ping search engines:', pingResponse.status);
          }
        } catch (pingError) {
          console.error('Error pinging search engines:', pingError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          feedsProcessed: results.length, 
          totalCandidates: allToProcess.length,
          totalProcessed: itemsToProcess.length,
          skippedDueToLimit: skippedCount,
          autoRetelled: totalRetelled,
          autoDialogues: totalDialogues,
          autoTweets: totalTweets,
          searchEnginesPinged: itemsToProcess.length > 0,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pending counts by country (for dashboard display)
    if (action === 'get_pending_stats') {
      // Get countries with 100% retell ratio
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, name, flag, retell_ratio')
        .eq('is_active', true)
        .gte('retell_ratio', 100);
      
      if (!countries || countries.length === 0) {
        return new Response(
          JSON.stringify({ success: true, pendingByCountry: [], total: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const pendingByCountry: { countryId: string; code: string; name: string; flag: string; count: number }[] = [];
      let totalPending = 0;
      
      for (const country of countries) {
        const { count } = await supabase
          .from('news_rss_items')
          .select('*', { count: 'exact', head: true })
          .eq('country_id', country.id)
          .is('content_en', null)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const pendingCount = count || 0;
        if (pendingCount > 0) {
          pendingByCountry.push({
            countryId: country.id,
            code: country.code,
            name: country.name,
            flag: country.flag,
            count: pendingCount
          });
          totalPending += pendingCount;
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, pendingByCountry, total: totalPending }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process pending news items that should have been retold but weren't (catch-up for missed items)
    // Now with batch processing and concurrency control
    if (action === 'process_pending') {
      const { countryCode, limit: processLimit = 20, batchSize = 5 } = body;
      
      // Get auto-generation settings including LLM model
      const { data: settings } = await supabase
        .from('settings')
        .select('news_auto_retell_enabled, news_auto_dialogue_enabled, news_auto_tweets_enabled, news_dialogue_count, news_tweet_count, llm_text_model, llm_text_provider')
        .limit(1)
        .single();
      
      const autoRetellEnabled = settings?.news_auto_retell_enabled ?? true;
      const autoDialogueEnabled = settings?.news_auto_dialogue_enabled ?? true;
      const autoTweetsEnabled = settings?.news_auto_tweets_enabled ?? true;
      const dialogueCount = settings?.news_dialogue_count ?? 7;
      const tweetCount = settings?.news_tweet_count ?? 4;
      
      // Determine LLM model name for display
      const llmProvider = settings?.llm_text_provider || 'lovable';
      const llmModel = settings?.llm_text_model || 'google/gemini-3-flash-preview';
      const llmDisplayName = llmModel.split('/').pop() || llmModel;
      
      // Get countries with 100% retell ratio
      const { data: countries } = await supabase
        .from('news_countries')
        .select('id, code, retell_ratio')
        .eq('is_active', true)
        .gte('retell_ratio', 100);
      
      const countryIds = countries?.map(c => c.id) || [];
      
      if (countryIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No countries with 100% retell ratio', processed: 0, logs: [], llmModel: llmDisplayName }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Find news items that should be retold but aren't (100% ratio countries, no content_en, recent)
      let query = supabase
        .from('news_rss_items')
        .select('id, title, slug, country:news_countries(code, name, flag)')
        .in('country_id', countryIds)
        .is('content_en', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(processLimit);
      
      if (countryCode) {
        const country = countries?.find(c => c.code.toLowerCase() === countryCode.toLowerCase());
        if (country) {
          query = supabase
            .from('news_rss_items')
            .select('id, title, slug, country:news_countries(code, name, flag)')
            .eq('country_id', country.id)
            .is('content_en', null)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(processLimit);
        }
      }
      
      const { data: pendingItems } = await query;
      
      if (!pendingItems || pendingItems.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No pending items to process', processed: 0, logs: [], llmModel: llmDisplayName }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[Pending] Processing ${pendingItems.length} items in batches of ${batchSize} using ${llmDisplayName}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      let totalRetelled = 0;
      let totalDialogues = 0;
      let totalTweets = 0;
      const logs: { id: string; title: string; country: string; flag: string; step: string; status: 'success' | 'error' | 'skip'; message: string; timestamp: string }[] = [];
      
      // Define pending item type
      type PendingItem = { id: string; title: string; slug: string | null; country: { code: string; name: string; flag: string }[] | null };
      
      // Helper function to process a single item
      async function processItem(item: PendingItem): Promise<void> {
        const newsId = item.id;
        const countryData = item.country as unknown as { code: string; name: string; flag: string } | null;
        const itemCountryCode = countryData?.code?.toLowerCase() || 'us';
        const countryName = countryData?.name || 'Unknown';
        const countryFlag = countryData?.flag || '🏳️';
        const shortTitle = item.title?.slice(0, 60) + (item.title?.length > 60 ? '...' : '');
        
        // Step 1: Retell
        if (autoRetellEnabled) {
          try {
            console.log(`[Pending] Retelling: ${newsId}`);
            const response = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({ newsId, model: 'google/gemini-3-flash-preview' })
            });
            
            if (response.ok) {
              totalRetelled++;
              logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'retell', status: 'success', message: `✓ ${llmDisplayName}`, timestamp: new Date().toISOString() });
            } else {
              logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'retell', status: 'error', message: `HTTP ${response.status}`, timestamp: new Date().toISOString() });
            }
          } catch (error) {
            logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'retell', status: 'error', message: String(error), timestamp: new Date().toISOString() });
          }
        }
        
        // Step 2: Generate dialogue
        if (autoDialogueEnabled) {
          try {
            const { data: article } = await supabase
              .from('news_rss_items')
              .select('*, feed:news_rss_feeds(name)')
              .eq('id', newsId)
              .single();
            
            if (article) {
              const detectLang = () => {
                if (itemCountryCode === 'ua') return 'uk';
                if (itemCountryCode === 'pl') return 'pl';
                if (itemCountryCode === 'in') return 'hi';
                return 'en';
              };
              
              const response = await fetch(`${supabaseUrl}/functions/v1/generate-dialogue`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  storyContext: `News article: ${article.title_en || article.title}\n\n${article.description_en || article.description || ''}\n\n${article.content_en || article.content || ''}`,
                  newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || 'general'}`,
                  messageCount: dialogueCount,
                  generateTweets: autoTweetsEnabled,
                  tweetCount,
                  contentLanguage: detectLang()
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.dialogue) {
                  await supabase
                    .from('news_rss_items')
                    .update({
                      chat_dialogue: result.dialogue,
                      tweets: result.tweets || null
                    })
                    .eq('id', newsId);
                  
                  totalDialogues++;
                  if (result.tweets) totalTweets++;
                  logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'dialogue', status: 'success', message: `✓ ${result.tweets ? '+твіти' : ''}`, timestamp: new Date().toISOString() });
                }
              } else {
                logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'dialogue', status: 'error', message: `HTTP ${response.status}`, timestamp: new Date().toISOString() });
              }
            }
          } catch (error) {
            logs.push({ id: newsId, title: shortTitle, country: countryName, flag: countryFlag, step: 'dialogue', status: 'error', message: String(error), timestamp: new Date().toISOString() });
          }
        }
      }
      
      // Process items in batches with concurrency
      const effectiveBatchSize = Math.min(batchSize, 5); // Cap at 5 concurrent
      for (let i = 0; i < pendingItems.length; i += effectiveBatchSize) {
        const batch = pendingItems.slice(i, i + effectiveBatchSize);
        console.log(`[Pending] Processing batch ${Math.floor(i / effectiveBatchSize) + 1}/${Math.ceil(pendingItems.length / effectiveBatchSize)} (${batch.length} items)`);
        
        // Process batch items in parallel
        await Promise.all(batch.map(item => processItem(item)));
        
        // Small delay between batches to avoid rate limiting
        if (i + effectiveBatchSize < pendingItems.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      
      console.log(`[Pending] Completed: ${pendingItems.length} items, ${totalRetelled} retelled, ${totalDialogues} dialogues, ${totalTweets} tweets using ${llmDisplayName}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          pendingFound: pendingItems.length,
          processed: totalRetelled,
          retelled: totalRetelled,
          dialogues: totalDialogues,
          tweets: totalTweets,
          logs,
          llmModel: llmDisplayName,
          batchSize: effectiveBatchSize
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all feeds for a specific country with progress reporting (for bulk download)
    if (action === 'fetch_country_bulk') {
      if (!countryId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Country ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feeds, error: feedsError } = await supabase
        .from('news_rss_feeds')
        .select('id, name, url, category')
        .eq('country_id', countryId)
        .eq('is_active', true);
      
      if (feedsError) {
        return new Response(
          JSON.stringify({ success: false, error: feedsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: countryData } = await supabase
        .from('news_countries')
        .select('code')
        .eq('id', countryId)
        .single();
      
      const countryCode = countryData?.code || 'unknown';
      
      console.log(`Bulk fetching ${feeds?.length || 0} feeds for country ${countryCode}...`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const results = [];
      let totalInserted = 0;
      let totalRetelled = 0;
      let retellCounter = 0;
      
      for (const feed of feeds || []) {
        try {
          const response = await fetch(feed.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            results.push({ feedName: feed.name, success: false, error: `HTTP ${response.status}`, inserted: 0 });
            continue;
          }
          
          const xml = await response.text();
          const items = parseXML(xml);
          
          // Get existing URLs to prevent duplicates
          const { data: existingItems } = await supabase
            .from('news_rss_items')
            .select('url')
            .eq('feed_id', feed.id);
          
          const existingUrls = new Set((existingItems || []).map(item => item.url));
          
          let insertedCount = 0;
          const itemsToRetell: string[] = [];
          
          for (const item of items.slice(0, 200)) {
            // Skip if already exists
            if (existingUrls.has(item.link)) continue;
            
            const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
            const slug = generateSlug(item.title);
            
            // Store original RSS content for AI retelling
            const originalDescription = item.description ? decodeHTMLEntities(item.description).slice(0, 1000) : null;
            const originalContent = item.content ? decodeHTMLEntities(item.content).slice(0, 5000) : null;
            
            const { data: insertedData, error: insertError } = await supabase
              .from('news_rss_items')
              .insert({
                feed_id: feed.id,
                country_id: countryId,
                external_id: item.link,
                title: decodeHTMLEntities(item.title).slice(0, 500),
                title_en: decodeHTMLEntities(item.title).slice(0, 500),
                description: originalDescription,
                description_en: originalDescription,
                content: originalContent,
                content_en: originalContent,
                original_content: originalContent || originalDescription, // Store original for AI retelling
                url: item.link,
                slug: slug,
                image_url: item.enclosure?.url || null,
                category: feed.category,
                published_at: pubDate?.toISOString() || null,
                fetched_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (!insertError && insertedData) {
              insertedCount++;
              totalInserted++;
              retellCounter++;
              existingUrls.add(item.link);
              
              // Every 5th item gets auto-retell
              if (retellCounter % 5 === 0) {
                itemsToRetell.push(insertedData.id);
              }
            }
          }
          
          await supabase
            .from('news_rss_feeds')
            .update({ last_fetched_at: new Date().toISOString(), fetch_error: null })
            .eq('id', feed.id);
          
          // Auto-retell items
          for (const newsId of itemsToRetell) {
            await autoRetellNews(newsId, supabaseUrl);
            totalRetelled++;
            await new Promise(r => setTimeout(r, 300));
          }
          
          results.push({ feedName: feed.name, success: true, inserted: insertedCount, retelled: itemsToRetell.length });
        } catch (error) {
          results.push({ 
            feedName: feed.name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            inserted: 0
          });
        }
      }
      
      console.log(`Bulk fetch complete: ${totalInserted} inserted, ${totalRetelled} retelled`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          countryCode,
          feedsProcessed: feeds?.length || 0,
          totalInserted,
          totalRetelled,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Full pipeline: fetch new items + retell + generate dialogues for ALL new items
    if (action === 'fetch_country_full') {
      if (!countryId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Country ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: feeds, error: feedsError } = await supabase
        .from('news_rss_feeds')
        .select('id, name, url, category')
        .eq('country_id', countryId)
        .eq('is_active', true);
      
      if (feedsError) {
        return new Response(
          JSON.stringify({ success: false, error: feedsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: countryData } = await supabase
        .from('news_countries')
        .select('code')
        .eq('id', countryId)
        .single();
      
      const countryCode = countryData?.code || 'unknown';
      
      console.log(`Full pipeline: fetching ${feeds?.length || 0} feeds for country ${countryCode}...`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const results = [];
      let totalInserted = 0;
      let totalRetelled = 0;
      let totalDialogues = 0;
      const allNewItemIds: string[] = [];
      
      // Step 1: Fetch all new items from all feeds
      for (const feed of feeds || []) {
        try {
          const response = await fetch(feed.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            results.push({ feedName: feed.name, success: false, error: `HTTP ${response.status}`, inserted: 0, retelled: 0, dialogues: 0 });
            continue;
          }
          
          const xml = await response.text();
          const items = parseXML(xml);
          
          // Get existing URLs to prevent duplicates
          const { data: existingItems } = await supabase
            .from('news_rss_items')
            .select('url')
            .eq('feed_id', feed.id);
          
          const existingUrls = new Set((existingItems || []).map(item => item.url));
          
          let insertedCount = 0;
          const feedNewIds: string[] = [];
          
          for (const item of items.slice(0, 200)) {
            // Skip if already exists
            if (existingUrls.has(item.link)) continue;
            
            const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
            const slug = generateSlug(item.title);
            
            // Store original RSS content for AI retelling
            const originalDescription = item.description ? decodeHTMLEntities(item.description).slice(0, 1000) : null;
            const originalContent = item.content ? decodeHTMLEntities(item.content).slice(0, 5000) : null;
            
            const { data: insertedData, error: insertError } = await supabase
              .from('news_rss_items')
              .insert({
                feed_id: feed.id,
                country_id: countryId,
                external_id: item.link,
                title: decodeHTMLEntities(item.title).slice(0, 500),
                title_en: decodeHTMLEntities(item.title).slice(0, 500),
                description: originalDescription,
                description_en: originalDescription,
                content: originalContent,
                content_en: originalContent,
                original_content: originalContent || originalDescription, // Store original for AI retelling
                url: item.link,
                slug: slug,
                image_url: item.enclosure?.url || null,
                category: feed.category,
                published_at: pubDate?.toISOString() || null,
                fetched_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (!insertError && insertedData) {
              insertedCount++;
              totalInserted++;
              feedNewIds.push(insertedData.id);
              allNewItemIds.push(insertedData.id);
              existingUrls.add(item.link);
            }
          }
          
          await supabase
            .from('news_rss_feeds')
            .update({ last_fetched_at: new Date().toISOString(), fetch_error: null })
            .eq('id', feed.id);
          
          results.push({ feedName: feed.name, success: true, inserted: insertedCount, retelled: 0, dialogues: 0 });
        } catch (error) {
          results.push({ 
            feedName: feed.name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            inserted: 0,
            retelled: 0,
            dialogues: 0
          });
        }
      }
      
      console.log(`Fetch complete. Processing ${allNewItemIds.length} new items with retell + dialogues...`);
      
      // Step 2: Retell ALL new items
      for (const newsId of allNewItemIds) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/retell-news`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({ newsId, model: 'google/gemini-3-flash-preview' })
          });
          
          if (response.ok) {
            totalRetelled++;
          } else {
            console.error(`Failed to retell news ${newsId}:`, response.status);
          }
        } catch (error) {
          console.error(`Error retelling news ${newsId}:`, error);
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`Retell complete. Generating dialogues for ${allNewItemIds.length} items...`);
      
      // Step 3: Generate dialogues for ALL new items
      for (const newsId of allNewItemIds) {
        try {
          // Get article data for dialogue generation
          const { data: article } = await supabase
            .from('news_rss_items')
            .select('*, feed:news_rss_feeds(name), country:news_countries(code)')
            .eq('id', newsId)
            .single();
          
          if (!article) continue;
          
          // Detect language based on country
          const detectLang = () => {
            const code = article.country?.code?.toLowerCase();
            if (code === 'ua') return 'uk';
            if (code === 'pl') return 'pl';
            if (code === 'in') return 'hi';
            return 'en';
          };
          
          const contentLanguage = detectLang();
          
          const response = await fetch(`${supabaseUrl}/functions/v1/generate-dialogue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              storyContext: `News article: ${article.title_en || article.title}\n\n${article.description_en || article.description || ''}\n\n${article.content_en || article.content || ''}`,
              newsContext: `Source: ${article.feed?.name || 'RSS'}, Category: ${article.category || 'general'}`,
              messageCount: 5,
              enableThreading: true,
              threadProbability: 30,
              contentLanguage
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.dialogue) {
              // Save dialogue to article
              await supabase
                .from('news_rss_items')
                .update({ chat_dialogue: result.dialogue })
                .eq('id', newsId);
              totalDialogues++;
            }
          } else {
            console.error(`Failed to generate dialogue for ${newsId}:`, response.status);
          }
        } catch (error) {
          console.error(`Error generating dialogue for ${newsId}:`, error);
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`Full pipeline complete: ${totalInserted} inserted, ${totalRetelled} retelled, ${totalDialogues} dialogues`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          countryCode,
          feedsProcessed: feeds?.length || 0,
          totalInserted,
          totalRetelled,
          totalDialogues,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-rss:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
