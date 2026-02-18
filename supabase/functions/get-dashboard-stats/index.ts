import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { password } = await req.json();
        const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');

        if (password !== ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const now = new Date();
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Basic Content Stats
        const [
            { count: volumesCount },
            { count: chaptersCount },
            { count: partsCount },
            { count: publishedPartsCount },
            { count: charactersCount },
            { count: newsItemsCount },
            { count: generationsCount }
        ] = await Promise.all([
            supabase.from('volumes').select('*', { count: 'exact', head: true }),
            supabase.from('chapters').select('*', { count: 'exact', head: true }),
            supabase.from('parts').select('*', { count: 'exact', head: true }),
            supabase.from('parts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
            supabase.from('characters').select('*', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('news_rss_items').select('*', { count: 'exact', head: true }),
            supabase.from('generations').select('*', { count: 'exact', head: true })
        ]);

        // 2. News Lifecycle Data (Last 7 days)
        // Refinement: "Retold" = news_rss_items with slug not null
        const [addedNews, retoldNews, botVisits] = await Promise.all([
            supabase.from('news_rss_items').select('created_at').gte('created_at', last7d),
            supabase.from('news_rss_items').select('created_at').not('slug', 'is', null).neq('slug', '').gte('created_at', last7d),
            supabase.from('bot_visits').select('created_at, path').gte('created_at', last7d)
        ]);

        const lifecycle: Record<string, { label: string, added: number, retold: number, botVisits: number }> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            lifecycle[key] = {
                label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
                added: 0,
                retold: 0,
                botVisits: 0
            };
        }

        addedNews.data?.forEach((item: any) => {
            const key = item.created_at.split('T')[0];
            if (lifecycle[key]) lifecycle[key].added++;
        });
        retoldNews.data?.forEach((item: any) => {
            const key = item.created_at.split('T')[0];
            if (lifecycle[key]) lifecycle[key].retold++;
        });
        botVisits.data?.forEach((item: any) => {
            const key = item.created_at?.split('T')[0];
            if (key && lifecycle[key] && item.path?.startsWith('/news/')) {
                lifecycle[key].botVisits++;
            }
        });

        const lifecycleStats = Object.values(lifecycle).reverse();

        // 3. Performance Data (Last 24h)
        const { data: perfLogs } = await supabase
            .from('llm_usage_logs')
            .select('provider, duration_ms, success, created_at')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

        const perfStats: Record<string, any> = {};
        perfLogs?.forEach((log: any) => {
            if (!perfStats[log.provider]) {
                perfStats[log.provider] = { provider: log.provider, count: 0, totalDuration: 0, successCount: 0 };
            }
            const s = perfStats[log.provider];
            s.count++;
            if (log.duration_ms) s.totalDuration += log.duration_ms;
            if (log.success) s.successCount++;
        });

        const performance = Object.values(perfStats).map((s: any) => ({
            provider: s.provider,
            avgLatency: s.count > 0 ? Math.round(s.totalDuration / s.count) : 0,
            successRate: s.count > 0 ? Math.round((s.successCount / s.count) * 100) : 0
        }));

        // 4. Geography Data (Refined counts per country)
        const { data: countries } = await supabase.from('news_countries').select('id, name, flag, code').eq('is_active', true);

        // Explicitly count items per country to avoid 1000-limit on join
        const countriesStats = await Promise.all((countries || []).map(async (c) => {
            const { count } = await supabase
                .from('news_rss_items')
                .select('*', { count: 'exact', head: true })
                .eq('country_id', c.id)
                .eq('is_archived', false);

            return {
                ...c,
                total: count || 0
            };
        }));

        // 5. SEO Summary
        const [
            { count: partsWithSeoDesc },
            { count: newsWithSlug },
            { count: wikiWithSlug }
        ] = await Promise.all([
            supabase.from('parts').select('*', { count: 'exact', head: true }).not('seo_description', 'is', null).neq('seo_description', ''),
            supabase.from('news_rss_items').select('*', { count: 'exact', head: true }).not('slug', 'is', null).neq('slug', ''),
            supabase.from('wiki_entities').select('*', { count: 'exact', head: true }).not('slug', 'is', null).neq('slug', '')
        ]);

        const seoSummary = {
            partsCoverage: partsCount ? Math.round((partsWithSeoDesc || 0) / partsCount * 100) : 0,
            newsCoverage: newsItemsCount ? Math.round((newsWithSlug || 0) / newsItemsCount * 100) : 0,
            wikiCoverage: charactersCount ? Math.round((wikiWithSlug || 0) / charactersCount * 100) : 0,
        };

        // 6. Recent Wiki Entities (Refinement)
        const { data: recentWiki } = await supabase
            .from('wiki_entities')
            .select('id, name, slug, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        const { data: recentNews } = await supabase
            .from('news_rss_items')
            .select('id, title, slug, fetched_at')
            .order('fetched_at', { ascending: false })
            .limit(5);

        const viewStats = await supabase.from('view_counts').select('views, unique_visitors');
        const totalViews = viewStats.data?.reduce((sum: number, v: any) => sum + (v.views || 0), 0) || 0;
        const uniqueVisitors = viewStats.data?.reduce((sum: number, v: any) => sum + (v.unique_visitors || 0), 0) || 0;

        return new Response(
            JSON.stringify({
                success: true,
                stats: {
                    counts: {
                        volumes: volumesCount || 0,
                        chapters: chaptersCount || 0,
                        parts: partsCount || 0,
                        publishedParts: publishedPartsCount || 0,
                        characters: charactersCount || 0,
                        newsItems: newsItemsCount || 0,
                        generations: generationsCount || 0,
                        totalViews,
                        uniqueVisitors
                    },
                    lifecycle: lifecycleStats,
                    performance,
                    seo: seoSummary,
                    countriesStats: countriesStats.sort((a, b) => b.total - a.total),
                    recentWiki: recentWiki || [],
                    recentNews: recentNews || []
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in get-dashboard-stats:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
