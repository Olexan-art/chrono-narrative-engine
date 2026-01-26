import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Track inserted items per country+category for auto-retell
const insertedItemsTracker: Map<string, string[]> = new Map();

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

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
  return title
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
        for (const item of items.slice(0, limit)) {
          // Skip if already exists
          if (existingUrls.has(item.link)) continue;
          
          const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
          const slug = generateSlug(item.title);
          
          const { error: insertError } = await supabase
            .from('news_rss_items')
            .insert({
              feed_id: feed.id,
              country_id: feed.country_id,
              external_id: item.link,
              title: item.title.slice(0, 500),
              title_en: item.title.slice(0, 500),
              description: item.description?.slice(0, 1000) || null,
              description_en: item.description?.slice(0, 1000) || null,
              content: item.content?.slice(0, 5000) || null,
              content_en: item.content?.slice(0, 5000) || null,
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
        for (const item of items.slice(0, 200)) { // Limit to 200 items per feed
          // Skip if already exists
          if (existingUrls.has(item.link)) continue;
          
          const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
          
          // Generate slug from title
          const slug = generateSlug(item.title);
          
          const { error: insertError } = await supabase
            .from('news_rss_items')
            .insert({
              feed_id: feed.id,
              country_id: feed.country_id,
              external_id: item.link,
              title: item.title.slice(0, 500),
              title_en: item.title.slice(0, 500), // English is the default
              description: item.description?.slice(0, 1000) || null,
              description_en: item.description?.slice(0, 1000) || null,
              content: item.content?.slice(0, 5000) || null,
              content_en: item.content?.slice(0, 5000) || null,
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

    // Fetch ALL active feeds (for cron job)
    if (action === 'fetch_all') {
      const { data: feeds, error: feedsError } = await supabase
        .from('news_rss_feeds')
        .select('id, name, country_id')
        .eq('is_active', true);
      
      if (feedsError) {
        return new Response(
          JSON.stringify({ success: false, error: feedsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Fetching all ${feeds?.length || 0} active RSS feeds...`);
      
      // Track inserted items per country+category for auto-retell (every 5th item)
      const insertTracker: Map<string, { count: number; toRetell: string[] }> = new Map();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      const results = [];
      for (const feed of feeds || []) {
        try {
          const { data: feedData } = await supabase
            .from('news_rss_feeds')
            .select('*, news_countries!inner(id, code)')
            .eq('id', feed.id)
            .single();
          
          if (!feedData) continue;
          
          const response = await fetch(feedData.url, {
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
          
          let insertedCount = 0;
          const countryCode = feedData.news_countries?.code || 'unknown';
          const category = feedData.category || 'general';
          const trackerKey = `${countryCode}_${category}`;
          
          // Initialize tracker for this country+category if not exists
          if (!insertTracker.has(trackerKey)) {
            insertTracker.set(trackerKey, { count: 0, toRetell: [] });
          }
          
          for (const item of items.slice(0, 200)) {
            const pubDate = item.pubDate ? parseRSSDate(item.pubDate) : null;
            const slug = generateSlug(item.title);
            
            // Try to insert - use returning to get the ID
            const { data: insertedData, error: insertError } = await supabase
              .from('news_rss_items')
              .upsert({
                feed_id: feed.id,
                country_id: feedData.country_id,
                external_id: item.link,
                title: item.title.slice(0, 500),
                title_en: item.title.slice(0, 500),
                description: item.description?.slice(0, 1000) || null,
                description_en: item.description?.slice(0, 1000) || null,
                content: item.content?.slice(0, 5000) || null,
                content_en: item.content?.slice(0, 5000) || null,
                url: item.link,
                slug: slug,
                image_url: item.enclosure?.url || null,
                category: feedData.category,
                published_at: pubDate?.toISOString() || null,
                fetched_at: new Date().toISOString()
              }, { onConflict: 'feed_id,url', ignoreDuplicates: false })
              .select('id')
              .single();
            
            if (!insertError && insertedData) {
              insertedCount++;
              
              // Track for auto-retell every 5th item per country+category
              const tracker = insertTracker.get(trackerKey)!;
              tracker.count++;
              
              // Every 5th item gets auto-retell
              if (tracker.count % 5 === 0) {
                tracker.toRetell.push(insertedData.id);
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
      
      // Auto-retell every 5th news item per country+category
      let totalRetelled = 0;
      for (const [key, tracker] of insertTracker.entries()) {
        if (tracker.toRetell.length > 0) {
          console.log(`Auto-retelling ${tracker.toRetell.length} items for ${key}`);
          for (const newsId of tracker.toRetell) {
            await autoRetellNews(newsId, supabaseUrl);
            totalRetelled++;
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
      
      console.log(`Completed fetching ${results.length} feeds, auto-retelled ${totalRetelled} items`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          feedsProcessed: results.length, 
          autoRetelled: totalRetelled,
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
