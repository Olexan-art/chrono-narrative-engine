import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping URL:', url);

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract metadata using regex (simple approach without DOM parser)
    const getMetaContent = (name: string): string | null => {
      // Try og: prefix first
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                      html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${name}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try twitter: prefix
      const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                           html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${name}["']`, 'i'));
      if (twitterMatch) return twitterMatch[1];

      // Try standard meta name
      const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
      if (metaMatch) return metaMatch[1];

      return null;
    };

    // Extract title
    let title = getMetaContent('title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : null;
    }

    // Extract description
    const description = getMetaContent('description');

    // Extract image
    let imageUrl = getMetaContent('image');
    
    // If image URL is relative, make it absolute
    if (imageUrl && !imageUrl.startsWith('http')) {
      const urlObj = new URL(url);
      imageUrl = imageUrl.startsWith('/') 
        ? `${urlObj.protocol}//${urlObj.host}${imageUrl}`
        : `${urlObj.protocol}//${urlObj.host}/${imageUrl}`;
    }

    // Extract article content (simplified - gets first large text block)
    let content = '';
    
    // Try to find article content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      // Strip HTML tags and get text
      content = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
    } else {
      // Fall back to meta description or first paragraphs
      const paragraphs: string[] = [];
      const pMatches = html.matchAll(/<p[^>]*>([^<]+)<\/p>/gi);
      for (const match of pMatches) {
        const text = match[1].trim();
        if (text.length > 50) {
          paragraphs.push(text);
          if (paragraphs.join(' ').length > 1500) break;
        }
      }
      content = paragraphs.join('\n\n') || description || '';
    }

    // Clean up content
    content = content
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Scraped successfully:', { title: title?.slice(0, 50), hasImage: !!imageUrl, contentLength: content.length });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: title || '',
          description: description || '',
          content: content,
          imageUrl: imageUrl || '',
          sourceUrl: url
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scraping:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to scrape URL' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
