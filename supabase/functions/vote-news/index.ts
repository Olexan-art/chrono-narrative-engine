import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-visitor-id',
};

// Generate a server-side visitor fingerprint from IP + User-Agent
function generateFingerprint(ip: string, userAgent: string): string {
  const raw = `${ip}::${userAgent}`;
  // Simple hash - consistent for same IP+UA combination
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `sv_${Math.abs(hash).toString(36)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, voteType } = await req.json();

    // Validate inputs
    if (!newsId || typeof newsId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid newsId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (voteType && !['like', 'dislike'].includes(voteType)) {
      return new Response(JSON.stringify({ error: 'Invalid voteType' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side fingerprint from IP + User-Agent
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const visitorId = generateFingerprint(ip, userAgent);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check existing vote
    const { data: existing } = await supabase
      .from('news_votes')
      .select('id, vote_type')
      .eq('news_item_id', newsId)
      .eq('visitor_id', visitorId)
      .maybeSingle();

    let newLikes: number;
    let newDislikes: number;

    // Get current counts
    const { data: newsItem } = await supabase
      .from('news_rss_items')
      .select('likes, dislikes')
      .eq('id', newsId)
      .single();

    if (!newsItem) {
      return new Response(JSON.stringify({ error: 'News not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let currentLikes = newsItem.likes || 0;
    let currentDislikes = newsItem.dislikes || 0;
    let resultVote: string | null = null;

    if (existing) {
      if (existing.vote_type === voteType) {
        // Toggle off - remove vote
        await supabase.from('news_votes').delete().eq('id', existing.id);
        if (voteType === 'like') currentLikes = Math.max(0, currentLikes - 1);
        else currentDislikes = Math.max(0, currentDislikes - 1);
        resultVote = null;
      } else if (voteType) {
        // Change vote
        await supabase.from('news_votes').update({ vote_type: voteType }).eq('id', existing.id);
        if (existing.vote_type === 'like') {
          currentLikes = Math.max(0, currentLikes - 1);
          currentDislikes += 1;
        } else {
          currentDislikes = Math.max(0, currentDislikes - 1);
          currentLikes += 1;
        }
        resultVote = voteType;
      }
    } else if (voteType) {
      // New vote
      await supabase.from('news_votes').insert({
        news_item_id: newsId,
        visitor_id: visitorId,
        vote_type: voteType,
      });
      if (voteType === 'like') currentLikes += 1;
      else currentDislikes += 1;
      resultVote = voteType;
    }

    // Update counters
    await supabase.from('news_rss_items').update({
      likes: currentLikes,
      dislikes: currentDislikes,
    }).eq('id', newsId);

    return new Response(JSON.stringify({
      success: true,
      vote: resultVote,
      likes: currentLikes,
      dislikes: currentDislikes,
      visitorId, // Return so client can check existing vote
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Vote error:', error);
    return new Response(JSON.stringify({ error: 'Vote failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
