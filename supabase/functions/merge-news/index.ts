import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple word-based similarity (Jaccard index on significant words)
function computeSimilarity(title1: string, title2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

// Also check English titles for cross-language matching
function bestSimilarity(a: any, b: any): number {
  const scores = [computeSimilarity(a.title, b.title)];
  if (a.title_en && b.title_en) scores.push(computeSimilarity(a.title_en, b.title_en));
  if (a.title_en && b.title) scores.push(computeSimilarity(a.title_en, b.title));
  if (a.title && b.title_en) scores.push(computeSimilarity(a.title, b.title_en));
  return Math.max(...scores);
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

    const action = url.searchParams.get('action') || 'scan';
    const threshold = parseFloat(url.searchParams.get('threshold') || '0.55');
    const hoursBack = parseInt(url.searchParams.get('hours') || '72');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'stats') {
      // Return merge statistics
      const [
        { count: totalGroups },
        { count: totalMergedItems },
        { data: recentGroups }
      ] = await Promise.all([
        supabase.from('news_merged_groups').select('*', { count: 'exact', head: true }),
        supabase.from('news_merged_items').select('*', { count: 'exact', head: true }),
        supabase.from('news_merged_groups')
          .select('id, title, title_en, merged_count, source_feeds, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      return new Response(JSON.stringify({
        total_groups: totalGroups || 0,
        total_merged_items: totalMergedItems || 0,
        recent_groups: recentGroups || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Scan for similar news in the last N hours
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: recentNews, error } = await supabase
      .from('news_rss_items')
      .select('id, title, title_en, slug, country_id, feed_id, published_at, image_url, news_rss_feeds(name)')
      .eq('is_archived', false)
      .gte('fetched_at', since)
      .not('slug', 'is', null)
      .order('published_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!recentNews || recentNews.length === 0) {
      return new Response(JSON.stringify({ message: 'No recent news to scan', groups: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already merged items - skip them
    const { data: alreadyMerged } = await supabase
      .from('news_merged_items')
      .select('news_item_id');
    const mergedSet = new Set((alreadyMerged || []).map(m => m.news_item_id));

    // Filter out already-merged news
    const candidates = recentNews.filter(n => !mergedSet.has(n.id));

    // Find similar pairs using greedy clustering
    const used = new Set<string>();
    const clusters: typeof candidates[] = [];

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(candidates[i].id)) continue;

      const cluster = [candidates[i]];
      used.add(candidates[i].id);

      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(candidates[j].id)) continue;

        // Check similarity against any member of the cluster
        const sim = bestSimilarity(candidates[i], candidates[j]);
        if (sim >= threshold) {
          cluster.push(candidates[j]);
          used.add(candidates[j].id);
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }

    if (action === 'scan') {
      // Just return what would be merged (dry run)
      const preview = clusters.map(cluster => ({
        count: cluster.length,
        titles: cluster.map(n => n.title_en || n.title),
        feeds: cluster.map(n => (n as any).news_rss_feeds?.name || 'Unknown'),
        similarity: cluster.length > 1 ? bestSimilarity(cluster[0], cluster[1]).toFixed(2) : '1.00',
      }));

      return new Response(JSON.stringify({
        message: `Found ${clusters.length} groups of similar news`,
        threshold,
        hours_back: hoursBack,
        total_scanned: candidates.length,
        groups: preview,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'merge') {
      // Actually create merged groups
      let created = 0;

      for (const cluster of clusters) {
        // Primary = the one with the most content (prefer content_en)
        const sorted = [...cluster].sort((a, b) => {
          const lenA = (a.content_en || a.content || '').length;
          const lenB = (b.content_en || b.content || '').length;
          return lenB - lenA;
        });
        const primary = sorted[0];

        // Build source feeds info
        const sourceFeedsInfo = cluster.map(n => ({
          name: (n as any).news_rss_feeds?.name || 'Unknown',
          news_id: n.id,
        }));

        // Create group
        const { data: group, error: groupError } = await supabase
          .from('news_merged_groups')
          .insert({
            title: primary.title,
            title_en: primary.title_en,
            slug: primary.slug,
            merged_count: cluster.length,
            source_feeds: sourceFeedsInfo,
            primary_news_id: primary.id,
          })
          .select('id')
          .single();

        if (groupError) {
          console.error('Failed to create group:', groupError);
          continue;
        }

        // Create junction items
        const items = cluster.map(n => ({
          group_id: group.id,
          news_item_id: n.id,
          similarity_score: n.id === primary.id ? 1.0 : bestSimilarity(primary, n),
        }));

        const { error: itemsError } = await supabase
          .from('news_merged_items')
          .insert(items);

        if (itemsError) {
          console.error('Failed to insert items:', itemsError);
        } else {
          created++;
        }
      }

      return new Response(JSON.stringify({
        message: `Created ${created} merged groups`,
        total_scanned: candidates.length,
        groups_created: created,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use scan, merge, or stats' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Merge news error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
