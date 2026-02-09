import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
};

const BASE_URL = "https://echoes2.com";

function addHreflangLinks(url: string): string {
  return `
    <xhtml:link rel="alternate" hreflang="uk" href="${url}" />
    <xhtml:link rel="alternate" hreflang="en" href="${url}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${url}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url}" />`;
}

async function fetchAllRows<T>(
  supabase: any,
  tableName: string,
  selectQuery: string,
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(selectQuery);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }
    query = query.range(offset, offset + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }
  return allRows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const entities = await fetchAllRows<{
      id: string; slug: string | null; updated_at: string; search_count: number;
    }>(
      supabase,
      "wiki_entities",
      "id, slug, updated_at, search_count",
      { column: "search_count", ascending: false }
    );

    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <!-- Wiki Entities Sitemap for ${BASE_URL} -->
  <!-- Generated: ${now} -->
  <!-- Total entities: ${entities.length} -->

  <url>
    <loc>${BASE_URL}/wiki</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>${addHreflangLinks(`${BASE_URL}/wiki`)}
  </url>
`;

    for (const entity of entities) {
      const path = entity.slug || entity.id;
      const url = `${BASE_URL}/wiki/${path}`;
      const priority = entity.search_count > 50 ? "0.7" : entity.search_count > 10 ? "0.6" : "0.5";
      xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${entity.updated_at || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${addHreflangLinks(url)}
  </url>`;
    }

    xml += `
</urlset>`;

    console.log(`Wiki sitemap generated: ${entities.length} entities`);

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=21600",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Wiki sitemap error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/wiki</loc><priority>0.8</priority></url>
</urlset>`,
      { headers: corsHeaders, status: 200 }
    );
  }
});
