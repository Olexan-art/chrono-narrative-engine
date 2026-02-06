import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WikiSearchResult {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
  description?: string;
  pageprops?: { wikibase_item?: string };
}

interface WikiEntity {
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  image_url?: string;
  wiki_url: string;
  wiki_url_en?: string;
  extract?: string;
  extract_en?: string;
  raw_data: Record<string, unknown>;
}

// Detect entity type based on Wikipedia categories and description
function detectEntityType(result: WikiSearchResult): string {
  const desc = (result.description || '').toLowerCase();
  const title = result.title.toLowerCase();
  
  // Person indicators
  const personKeywords = ['born', 'politician', 'actor', 'actress', 'singer', 'musician', 'athlete', 
    'president', 'minister', 'ceo', 'founder', 'author', 'writer', 'director', 'businessman',
    'businesswoman', 'entrepreneur', 'journalist', 'scientist', 'professor', 'footballer', 
    'basketball', 'tennis', 'celebrity', 'artist', 'comedian', 'politician'];
  
  // Company/organization indicators
  const companyKeywords = ['company', 'corporation', 'inc.', 'ltd', 'llc', 'enterprise', 'group',
    'organization', 'organisation', 'foundation', 'institute', 'association', 'agency',
    'firm', 'brand', 'manufacturer', 'tech company', 'technology company', 'bank', 'airline',
    'automotive', 'multinational', 'conglomerate'];
  
  if (personKeywords.some(kw => desc.includes(kw))) return 'person';
  if (companyKeywords.some(kw => desc.includes(kw) || title.includes(kw))) return 'company';
  
  // Check if it's a proper noun (likely a named entity)
  if (result.title.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/)) return 'person';
  
  return 'organization';
}

// Search Wikipedia API
async function searchWikipedia(term: string, language: string = 'en'): Promise<WikiSearchResult | null> {
  const baseUrl = language === 'en' 
    ? 'https://en.wikipedia.org/w/api.php'
    : `https://${language}.wikipedia.org/w/api.php`;
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts|pageimages|description|pageprops',
    exintro: 'true',
    explaintext: 'true',
    exsentences: '3',
    piprop: 'thumbnail',
    pithumbsize: '300',
    titles: term,
    redirects: '1',
  });

  try {
    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();
    
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null; // Not found
    
    return { ...pages[pageId], pageid: parseInt(pageId) };
  } catch (error) {
    console.error(`Error searching Wikipedia for "${term}":`, error);
    return null;
  }
}

// Convert Wikipedia result to our entity format
function wikiResultToEntity(result: WikiSearchResult, language: string): WikiEntity {
  const wikiId = result.pageprops?.wikibase_item || `wiki_${language}_${result.pageid}`;
  const entityType = detectEntityType(result);
  const wikiUrl = language === 'en'
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`
    : `https://${language}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;

  return {
    wiki_id: wikiId,
    entity_type: entityType,
    name: result.title,
    name_en: language === 'en' ? result.title : undefined,
    description: result.description,
    description_en: language === 'en' ? result.description : undefined,
    image_url: result.thumbnail?.source,
    wiki_url: wikiUrl,
    wiki_url_en: language === 'en' ? wikiUrl : undefined,
    extract: result.extract,
    extract_en: language === 'en' ? result.extract : undefined,
    raw_data: result as unknown as Record<string, unknown>,
  };
}

// Extract potential entity names from title and keywords
function extractSearchTerms(title: string, keywords: string[]): string[] {
  const terms = new Set<string>();
  
  // From keywords - filter likely entity names (proper nouns, capitalized)
  keywords.forEach(kw => {
    const cleaned = kw.trim();
    // Check if it's likely a proper noun (starts with capital, multiple words)
    if (cleaned.match(/^[A-Z][a-zA-Z]+(\s+[A-Z]?[a-zA-Z]+)*$/)) {
      terms.add(cleaned);
    }
    // Check for known patterns
    if (cleaned.match(/^[A-Z]{2,}$/)) { // Acronyms like "NASA", "FBI"
      terms.add(cleaned);
    }
  });
  
  // From title - extract capitalized phrases (likely names/companies)
  const titleMatches = title.match(/[A-Z][a-z]+(\s+[A-Z][a-z]+)+/g) || [];
  titleMatches.forEach(match => {
    if (match.length > 3) terms.add(match);
  });
  
  // Extract quoted phrases from title
  const quotedMatches = title.match(/"([^"]+)"/g) || [];
  quotedMatches.forEach(match => {
    terms.add(match.replace(/"/g, ''));
  });
  
  return Array.from(terms).slice(0, 5); // Limit to 5 terms
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, terms, title, keywords, language = 'en' } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine search terms
    let searchTerms: string[] = terms || [];
    if (searchTerms.length === 0 && (title || keywords)) {
      searchTerms = extractSearchTerms(title || '', keywords || []);
    }

    if (searchTerms.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        entities: [], 
        message: 'No entity terms to search' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Searching Wikipedia for terms:`, searchTerms);

    const foundEntities: Array<{ entity: WikiEntity; matchTerm: string }> = [];

    // Search for each term
    for (const term of searchTerms) {
      // First try English Wikipedia
      let result = await searchWikipedia(term, 'en');
      
      // If not found in English and language is different, try that language
      if (!result && language !== 'en') {
        result = await searchWikipedia(term, language);
      }

      if (result) {
        const entity = wikiResultToEntity(result, result.extract ? 'en' : language);
        foundEntities.push({ entity, matchTerm: term });
        console.log(`Found entity: ${entity.name} (${entity.entity_type})`);
      }
    }

    if (foundEntities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        entities: [], 
        message: 'No Wikipedia entities found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save entities to database
    const savedEntities = [];
    for (const { entity, matchTerm } of foundEntities) {
      // Check if entity already exists
      const { data: existing } = await supabase
        .from('wiki_entities')
        .select('id')
        .eq('wiki_id', entity.wiki_id)
        .maybeSingle();

      let entityId: string;

      if (existing) {
        // Update search count
        await supabase
          .from('wiki_entities')
          .update({ 
            search_count: supabase.rpc('increment', { row_id: existing.id }),
            last_searched_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        entityId = existing.id;
      } else {
        // Insert new entity
        const { data: inserted, error } = await supabase
          .from('wiki_entities')
          .insert(entity)
          .select('id')
          .single();

        if (error) {
          console.error('Error inserting entity:', error);
          continue;
        }
        entityId = inserted.id;
      }

      // Link to news if newsId provided
      if (newsId) {
        const { error: linkError } = await supabase
          .from('news_wiki_entities')
          .upsert({
            news_item_id: newsId,
            wiki_entity_id: entityId,
            match_source: 'keyword',
            match_term: matchTerm,
          }, { onConflict: 'news_item_id,wiki_entity_id' });

        if (linkError) {
          console.error('Error linking entity to news:', linkError);
        }
      }

      savedEntities.push({ ...entity, id: entityId, matchTerm });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      entities: savedEntities,
      count: savedEntities.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-wiki:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
