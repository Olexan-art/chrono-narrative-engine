import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
};

const BASE_URL = "https://echoes2.com";

// Helper to add hreflang links for multilingual pages
function addHreflangLinks(url: string): string {
  return `
    <xhtml:link rel="alternate" hreflang="uk" href="${url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${url}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all published parts
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("date, updated_at, title")
      .eq("status", "published")
      .order("date", { ascending: false });

    if (partsError) throw partsError;

    // Fetch all chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("id, number, updated_at, title")
      .order("created_at", { ascending: false });

    if (chaptersError) throw chaptersError;

    // Fetch all volumes
    const { data: volumes, error: volumesError } = await supabase
      .from("volumes")
      .select("id, year, month, updated_at, title")
      .order("created_at", { ascending: false });

    if (volumesError) throw volumesError;

    // Group parts by date to count stories per day and get latest update
    const partsByDate = new Map<string, { count: number; updated_at: string }>();
    for (const part of parts || []) {
      const existing = partsByDate.get(part.date);
      if (existing) {
        existing.count++;
        if (part.updated_at > existing.updated_at) {
          existing.updated_at = part.updated_at;
        }
      } else {
        partsByDate.set(part.date, { count: 1, updated_at: part.updated_at });
      }
    }

    // Build sitemap XML
    const now = new Date().toISOString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  
  <!-- Static pages -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${addHreflangLinks(`${BASE_URL}/`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/calendar</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/calendar`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/chapters</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/chapters`)}
  </url>
  
  <url>
    <loc>${BASE_URL}/volumes</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(`${BASE_URL}/volumes`)}
  </url>
`;

    // Add date listing pages (/date/:date) for each unique date with stories
    for (const [date, info] of partsByDate) {
      const url = `${BASE_URL}/date/${date}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${info.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add individual story pages (/read/:date/:storyNumber)
    for (const [date, info] of partsByDate) {
      for (let i = 1; i <= info.count; i++) {
        const url = `${BASE_URL}/read/${date}/${i}`;
        xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${info.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${addHreflangLinks(url)}
  </url>`;
      }
    }

    // Add chapter pages (friendly URLs using chapter number)
    for (const chapter of chapters || []) {
      const url = `${BASE_URL}/chapter/${chapter.number}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${chapter.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${addHreflangLinks(url)}
  </url>`;
    }

    // Add volume pages (friendly URLs using year-month)
    for (const volume of volumes || []) {
      const yearMonth = `${volume.year}-${String(volume.month).padStart(2, '0')}`;
      const url = `${BASE_URL}/volume/${yearMonth}`;
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${volume.updated_at || now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${addHreflangLinks(url)}
  </url>`;
    }

    xml += `
</urlset>`;

    return new Response(xml, { 
      headers: corsHeaders,
      status: 200 
    });

  } catch (error) {
    console.error("Sitemap generation error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`,
      { headers: corsHeaders, status: 200 }
    );
  }
});
