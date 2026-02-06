import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, password, data } = await req.json();

    // Get admin password from environment variable (not hardcoded)
    const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD');
    
    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password for all admin actions
    if (password !== ADMIN_PASSWORD) {
      console.log('Admin auth failed: incorrect password');
      return new Response(
        JSON.stringify({ error: 'Невірний пароль' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Admin action: ${action}`);

    switch (action) {
      case 'verify': {
        return new Response(
          JSON.stringify({ success: true, message: 'Авторизація успішна' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getSettings': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('*')
          .limit(1)
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, settings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Safe helper: expose ONLY which LLM providers are configured (no keys returned).
      case 'getLLMAvailability': {
        const { data: settings, error } = await supabase
          .from('settings')
          .select('openai_api_key, gemini_api_key, gemini_v22_api_key, anthropic_api_key, zai_api_key, mistral_api_key')
          .limit(1)
          .single();

        if (error) throw error;

        const availability = {
          hasOpenai: !!settings?.openai_api_key,
          hasGemini: !!settings?.gemini_api_key,
          hasGeminiV22: !!settings?.gemini_v22_api_key,
          hasAnthropic: !!settings?.anthropic_api_key,
          hasZai: !!settings?.zai_api_key,
          hasMistral: !!settings?.mistral_api_key,
        };

        return new Response(
          JSON.stringify({ success: true, availability }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateSettings': {
        const { error } = await supabase
          .from('settings')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createVolume': {
        const { data: volume, error } = await supabase
          .from('volumes')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, volume }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateVolume': {
        const { error } = await supabase
          .from('volumes')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createChapter': {
        const { data: chapter, error } = await supabase
          .from('chapters')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, chapter }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateChapter': {
        const { error } = await supabase
          .from('chapters')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteChapter': {
        const { error } = await supabase
          .from('chapters')
          .delete()
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createPart': {
        const { data: part, error } = await supabase
          .from('parts')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, part }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updatePart': {
        const { error } = await supabase
          .from('parts')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deletePart': {
        const { error } = await supabase
          .from('parts')
          .delete()
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'publishPart': {
        const { error } = await supabase
          .from('parts')
          .update({ 
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schedulePart': {
        const { error } = await supabase
          .from('parts')
          .update({ 
            status: 'scheduled',
            scheduled_at: data.scheduled_at
          })
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createCharacter': {
        const { data: character, error } = await supabase
          .from('characters')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, character }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateCharacter': {
        const { error } = await supabase
          .from('characters')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteCharacter': {
        const { error } = await supabase
          .from('characters')
          .delete()
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'createRelationship': {
        const { data: relationship, error } = await supabase
          .from('character_relationships')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, relationship }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .update(data)
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteRelationship': {
        const { error } = await supabase
          .from('character_relationships')
          .delete()
          .eq('id', data.id);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getStats': {
        const [volumes, chapters, parts, generations] = await Promise.all([
          supabase.from('volumes').select('id', { count: 'exact' }),
          supabase.from('chapters').select('id', { count: 'exact' }),
          supabase.from('parts').select('id, status', { count: 'exact' }),
          supabase.from('generations').select('id', { count: 'exact' })
        ]);

        const publishedParts = await supabase
          .from('parts')
          .select('id', { count: 'exact' })
          .eq('status', 'published');

        return new Response(
          JSON.stringify({ 
            success: true, 
            stats: {
              volumes: volumes.count || 0,
              chapters: chapters.count || 0,
              parts: parts.count || 0,
              publishedParts: publishedParts.count || 0,
              generations: generations.count || 0
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAutoGenStats': {
        // Helper to get stats for a specific period
        async function getStatsForPeriod(since: string) {
          const [retoldResult, dialogueResult, tweetResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', since)
              .not('tweets', 'is', null)
              .neq('tweets', '[]')
          ]);
          
          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0
          };
        }
        
        // Helper to get stats for a specific day range
        async function getStatsForDay(startDate: Date, endDate: Date) {
          const startISO = startDate.toISOString();
          const endISO = endDate.toISOString();
          
          const [retoldResult, dialogueResult, tweetResult] = await Promise.all([
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('content', 'is', null)
              .gte('content', 'length.300'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('chat_dialogue', 'is', null)
              .neq('chat_dialogue', '[]'),
            supabase
              .from('news_rss_items')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startISO)
              .lt('created_at', endISO)
              .not('tweets', 'is', null)
              .neq('tweets', '[]')
          ]);
          
          return {
            retold: retoldResult.count || 0,
            dialogues: dialogueResult.count || 0,
            tweets: tweetResult.count || 0
          };
        }
        
        const now = new Date();
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Fetch all periods in parallel
        const [stats24h, stats3d, stats7d, stats30d] = await Promise.all([
          getStatsForPeriod(h24),
          getStatsForPeriod(d3),
          getStatsForPeriod(d7),
          getStatsForPeriod(d30)
        ]);
        
        // Generate daily stats for last 7 days
        const dailyPromises = [];
        const dayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setHours(0, 0, 0, 0);
          dayStart.setDate(dayStart.getDate() - i);
          
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          
          dailyPromises.push(
            getStatsForDay(dayStart, dayEnd).then(stats => ({
              date: dayStart.toISOString().split('T')[0],
              label: `${dayStart.getDate()}.${String(dayStart.getMonth() + 1).padStart(2, '0')}`,
              ...stats
            }))
          );
        }
        
        const daily = await Promise.all(dailyPromises);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            stats: {
              h24: stats24h,
              d3: stats3d,
              d7: stats7d,
              d30: stats30d,
              daily
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
