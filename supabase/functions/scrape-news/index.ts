import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Source-specific selectors configuration
const SOURCE_CONFIGS: Record<string, {
  contentSelectors: string[];
  removeSelectors: string[];
  titleSelector?: string;
  descriptionSelector?: string;
}> = {
  // Ukrainian sources
  'pravda.com.ua': {
    contentSelectors: ['article.post', '.post_text', '.post-body'],
    removeSelectors: ['.post_tags', '.post_news_related', '.post_share', '.adv', '.comments'],
  },
  'ukrinform.ua': {
    contentSelectors: ['.newsText', '.article-content', '.article__body'],
    removeSelectors: ['.article-tags', '.related-news', '.social-share'],
  },
  'unian.ua': {
    contentSelectors: ['.article-text', '.article__content', '.article-body'],
    removeSelectors: ['.article-tags', '.related', '.social'],
  },
  'nv.ua': {
    contentSelectors: ['.article__content', '.article-body', '.content-block'],
    removeSelectors: ['.article-footer', '.related-articles', '.adv-block'],
  },
  'liga.net': {
    contentSelectors: ['.article-body', '.article-text', '.news-text'],
    removeSelectors: ['.article-footer', '.news-related', '.social-share'],
  },
  'zn.ua': {
    contentSelectors: ['.article-content', '.article__body', '.news-body'],
    removeSelectors: ['.article-footer', '.related', '.comments'],
  },
  // Indian sources
  'thehindu.com': {
    contentSelectors: ['.article-body', '.articlebodycontent', '.paywall'],
    removeSelectors: ['.related-article', '.article-footer', '.share-social'],
  },
  'hindustantimes.com': {
    contentSelectors: ['.storyDetails', '.story-detail', '.article-content'],
    removeSelectors: ['.related-stories', '.share-section', '.advertisement'],
  },
  'indiatoday.in': {
    contentSelectors: ['.Story_description', '.article__content', '.story-body'],
    removeSelectors: ['.story-tags', '.related', '.social-share'],
  },
  'ndtv.com': {
    contentSelectors: ['.story__content', '.article_content', '.story-content'],
    removeSelectors: ['.story-footer', '.related-stories', '.ad-container'],
  },
  'timesofindia.indiatimes.com': {
    contentSelectors: ['.artText', '.article-content', '.story-content'],
    removeSelectors: ['.related-articles', '.social-share', '.comments'],
  },
  // US sources
  'cnn.com': {
    contentSelectors: ['.article__content', '.zn-body__paragraph', '.body-text'],
    removeSelectors: ['.el__embedded', '.zn-body__footer', '.ad-slot'],
  },
  'nytimes.com': {
    contentSelectors: ['.story-body', '.article-body', '.StoryBodyCompanion'],
    removeSelectors: ['.story-footer', '.related-articles', '.ad'],
  },
  'washingtonpost.com': {
    contentSelectors: ['.article-body', '.teaser-content', '.article__body'],
    removeSelectors: ['.related-articles', '.subscription-promo', '.ad-wrapper'],
  },
  'foxnews.com': {
    contentSelectors: ['.article-body', '.article-content', '.story-body'],
    removeSelectors: ['.related-articles', '.social-icons', '.video-embed'],
  },
  'bbc.com': {
    contentSelectors: ['article[role="main"]', '.article__body-content', '.story-body'],
    removeSelectors: ['.story-footer', '.related-topics', '.ad-slot'],
  },
  'reuters.com': {
    contentSelectors: ['.article-body', '[class*="Paragraph-"]', '.StandardArticleBody_body'],
    removeSelectors: ['.article-footer', '.related-articles', '.ad-container'],
  },
  'apnews.com': {
    contentSelectors: ['.RichTextStoryBody', '.Article', '.story-body'],
    removeSelectors: ['.RelatedStory', '.ad-container', '.social-share'],
  },
  // European sources
  'theguardian.com': {
    contentSelectors: ['.article-body-commercial-selector', '.content__article-body', '.article-body'],
    removeSelectors: ['.submeta', '.after-article', '.ad-slot'],
  },
  'lemonde.fr': {
    contentSelectors: ['.article__content', '.article-body', '.post__content'],
    removeSelectors: ['.article__footer', '.related', '.ad-slot'],
  },
  'spiegel.de': {
    contentSelectors: ['.article-section', '.RichText', '.article-body'],
    removeSelectors: ['.article-footer', '.related-articles', '.ad-container'],
  },
};

// Get domain from URL
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' prefix and get base domain
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Find matching config for domain
function getSourceConfig(domain: string) {
  // Direct match
  if (SOURCE_CONFIGS[domain]) {
    return SOURCE_CONFIGS[domain];
  }
  
  // Check if domain ends with any configured source
  for (const [sourceDomain, config] of Object.entries(SOURCE_CONFIGS)) {
    if (domain.endsWith(sourceDomain)) {
      return config;
    }
  }
  
  return null;
}

// Extract content using source-specific selectors
function extractWithSelectors(html: string, selectors: string[]): string {
  for (const selector of selectors) {
    // Convert CSS selector to regex pattern (simplified)
    let pattern: RegExp | null = null;
    
    if (selector.startsWith('.')) {
      // Class selector
      const className = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
    } else if (selector.startsWith('#')) {
      // ID selector
      const id = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'gi');
    } else if (selector.includes('[')) {
      // Attribute selector (e.g., article[role="main"])
      const match = selector.match(/(\w+)\[([^=]+)=["']([^"']+)["']\]/);
      if (match) {
        const [, tag, attr, value] = match;
        pattern = new RegExp(`<${tag}[^>]*${attr}=["']${value}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      }
    } else {
      // Tag selector
      const tag = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    }
    
    if (pattern) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        // Get the longest match (most likely the main content)
        const content = matches
          .map(m => m[1] || m[0])
          .sort((a, b) => b.length - a.length)[0];
        
        if (content && content.length > 200) {
          return content;
        }
      }
    }
  }
  
  return '';
}

// Remove unwanted elements
function removeElements(html: string, selectors: string[]): string {
  let result = html;
  
  for (const selector of selectors) {
    let pattern: RegExp | null = null;
    
    if (selector.startsWith('.')) {
      const className = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
    } else if (selector.startsWith('#')) {
      const id = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`<[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
    }
    
    if (pattern) {
      result = result.replace(pattern, '');
    }
  }
  
  return result;
}

// Clean HTML to plain text
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

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

    const domain = getDomain(url);
    const sourceConfig = getSourceConfig(domain);
    
    console.log('Scraping URL:', url);
    console.log('Domain:', domain);
    console.log('Has source config:', !!sourceConfig);

    // User-Agent rotation for 403 bypass
    const USER_AGENTS = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // Fetch with retries for 403
    const fetchWithRetry = async (retries = 2): Promise<Response> => {
      for (let i = 0; i <= retries; i++) {
        const ua = i === 0 ? randomUA : USER_AGENTS[i % USER_AGENTS.length];
        const response = await fetch(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8,pl;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.google.com/',
          }
        });
        
        if (response.ok) return response;
        if (response.status === 403 && i < retries) {
          console.log(`Retry ${i + 1}/${retries} for 403 with different UA`);
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return response;
      }
      throw new Error('All retries exhausted');
    };
    
    const response = await fetchWithRetry();

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract metadata using regex
    const getMetaContent = (name: string): string | null => {
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                      html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${name}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
                           html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${name}["']`, 'i'));
      if (twitterMatch) return twitterMatch[1];

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
    if (imageUrl && !imageUrl.startsWith('http')) {
      const urlObj = new URL(url);
      imageUrl = imageUrl.startsWith('/') 
        ? `${urlObj.protocol}//${urlObj.host}${imageUrl}`
        : `${urlObj.protocol}//${urlObj.host}/${imageUrl}`;
    }

    // Extract content
    let content = '';
    let extractionMethod = 'generic';
    
    if (sourceConfig) {
      // Use source-specific extraction
      extractionMethod = 'source-specific';
      
      // First remove unwanted elements
      let cleanedHtml = removeElements(html, sourceConfig.removeSelectors);
      
      // Then extract content using selectors
      const extractedHtml = extractWithSelectors(cleanedHtml, sourceConfig.contentSelectors);
      
      if (extractedHtml) {
        content = htmlToText(extractedHtml);
      }
    }
    
    // Fallback to generic extraction
    if (!content || content.length < 200) {
      extractionMethod = content ? 'fallback' : 'generic';
      
      // Try article tag
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        content = htmlToText(articleMatch[1]);
      }
      
      // If still not enough content, try main tag
      if (!content || content.length < 200) {
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch) {
          content = htmlToText(mainMatch[1]);
        }
      }
      
      // Fall back to paragraphs
      if (!content || content.length < 200) {
        const paragraphs: string[] = [];
        const pMatches = html.matchAll(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/gi);
        for (const match of pMatches) {
          const text = htmlToText(match[1]).trim();
          if (text.length > 50) {
            paragraphs.push(text);
            if (paragraphs.join(' ').length > 3000) break;
          }
        }
        if (paragraphs.length > 0) {
          content = paragraphs.join('\n\n');
        }
      }
    }
    
    // Final cleanup and limit
    content = content.slice(0, 10000);

    console.log('Scraped successfully:', { 
      title: title?.slice(0, 50), 
      hasImage: !!imageUrl, 
      contentLength: content.length,
      extractionMethod,
      domain
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: title || '',
          description: description || '',
          content: content,
          imageUrl: imageUrl || '',
          sourceUrl: url,
          extractionMethod,
          domain
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
