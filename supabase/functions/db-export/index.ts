import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLES = [
  'news_countries',
  'news_rss_feeds',
  'news_rss_items',
  'news_merged_groups',
  'news_merged_items',
  'news_wiki_entities',
  'news_votes',
  'wiki_entities',
  'wiki_entity_aliases',
  'wiki_entity_links',
  'narrative_analyses',
  'outrage_ink',
  'outrage_ink_entities',
  'outrage_ink_votes',
  'volumes',
  'chapters',
  'parts',
  'characters',
  'character_relationships',
  'news_items',
  'generations',
  'settings',
  'view_counts',
  'daily_views',
  'bot_visits',
  'cached_pages',
  'sitemap_metadata',
  'user_roles',
];

async function fetchAllRows(supabase: any, table: string) {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      return { table, error: error.message, rows: [] };
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }

  return { table, rows: allRows, count: allRows.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const password = url.searchParams.get('password');
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');

    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const singleTable = url.searchParams.get('table');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Export single table
    if (singleTable) {
      const result = await fetchAllRows(supabase, singleTable);
      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${singleTable}_export.json"`,
        },
      });
    }

    // Export all tables
    const tablesToExport = url.searchParams.get('tables')
      ? url.searchParams.get('tables')!.split(',')
      : TABLES;

    const exportData: Record<string, any> = {
      exported_at: new Date().toISOString(),
      tables: {},
    };

    for (const table of tablesToExport) {
      console.log(`Exporting ${table}...`);
      const result = await fetchAllRows(supabase, table);
      exportData.tables[table] = {
        count: result.count,
        rows: result.rows,
        ...(result.error ? { error: result.error } : {}),
      };
    }

    const totalRows = Object.values(exportData.tables).reduce(
      (sum: number, t: any) => sum + (t.count || 0), 0
    );
    exportData.total_rows = totalRows;
    exportData.total_tables = tablesToExport.length;

    const json = JSON.stringify(exportData, null, 2);

    return new Response(json, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="db_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
