import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function uploadBase64ToStorage(
  supabase: any,
  base64Data: string,
  path: string
): Promise<string> {
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 format");

  const mimeType = matches[1];
  const base64Content = matches[2];
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("covers")
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 3, table = 'parts' } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let migratedCount = 0;
    const errors: string[] = [];
    const migrated: string[] = [];

    if (table === 'parts' || table === 'all') {
      // Get parts with base64 images - only a few at a time
      const { data: parts, error: fetchError } = await supabase
        .from("parts")
        .select("id, cover_image_url, cover_image_url_2")
        .or("cover_image_url.like.data:%,cover_image_url_2.like.data:%")
        .limit(limit);

      if (fetchError) throw fetchError;

      console.log(`Found ${parts?.length || 0} parts with base64 images`);

      for (const part of parts || []) {
        try {
          if (part.cover_image_url?.startsWith("data:")) {
            console.log(`Migrating part ${part.id} cover_image_url...`);
            const newUrl = await uploadBase64ToStorage(supabase, part.cover_image_url, `parts/${part.id}/cover.png`);
            await supabase.from("parts").update({ cover_image_url: newUrl }).eq("id", part.id);
            migratedCount++;
            migrated.push(`Part ${part.id} cover`);
          }

          if (part.cover_image_url_2?.startsWith("data:")) {
            console.log(`Migrating part ${part.id} cover_image_url_2...`);
            const newUrl = await uploadBase64ToStorage(supabase, part.cover_image_url_2, `parts/${part.id}/cover2.png`);
            await supabase.from("parts").update({ cover_image_url_2: newUrl }).eq("id", part.id);
            migratedCount++;
            migrated.push(`Part ${part.id} cover2`);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Error migrating part ${part.id}:`, message);
          errors.push(`Part ${part.id}: ${message}`);
        }
      }
    }

    if (table === 'chapters' || table === 'all') {
      const { data: chapters, error: chaptersError } = await supabase
        .from("chapters")
        .select("id, cover_image_url, cover_image_url_2, cover_image_url_3")
        .or("cover_image_url.like.data:%,cover_image_url_2.like.data:%,cover_image_url_3.like.data:%")
        .limit(limit);

      if (!chaptersError) {
        console.log(`Found ${chapters?.length || 0} chapters with base64 images`);
        
        for (const chapter of chapters || []) {
          try {
            if (chapter.cover_image_url?.startsWith("data:")) {
              const newUrl = await uploadBase64ToStorage(supabase, chapter.cover_image_url, `chapters/${chapter.id}/cover.png`);
              await supabase.from("chapters").update({ cover_image_url: newUrl }).eq("id", chapter.id);
              migratedCount++;
              migrated.push(`Chapter ${chapter.id} cover`);
            }
            if (chapter.cover_image_url_2?.startsWith("data:")) {
              const newUrl = await uploadBase64ToStorage(supabase, chapter.cover_image_url_2, `chapters/${chapter.id}/cover2.png`);
              await supabase.from("chapters").update({ cover_image_url_2: newUrl }).eq("id", chapter.id);
              migratedCount++;
              migrated.push(`Chapter ${chapter.id} cover2`);
            }
            if (chapter.cover_image_url_3?.startsWith("data:")) {
              const newUrl = await uploadBase64ToStorage(supabase, chapter.cover_image_url_3, `chapters/${chapter.id}/cover3.png`);
              await supabase.from("chapters").update({ cover_image_url_3: newUrl }).eq("id", chapter.id);
              migratedCount++;
              migrated.push(`Chapter ${chapter.id} cover3`);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Chapter ${chapter.id}: ${message}`);
          }
        }
      }
    }

    if (table === 'volumes' || table === 'all') {
      const { data: volumes, error: volumesError } = await supabase
        .from("volumes")
        .select("id, cover_image_url")
        .like("cover_image_url", "data:%")
        .limit(limit);

      if (!volumesError) {
        console.log(`Found ${volumes?.length || 0} volumes with base64 images`);
        
        for (const volume of volumes || []) {
          try {
            if (volume.cover_image_url?.startsWith("data:")) {
              const newUrl = await uploadBase64ToStorage(supabase, volume.cover_image_url, `volumes/${volume.id}/cover.png`);
              await supabase.from("volumes").update({ cover_image_url: newUrl }).eq("id", volume.id);
              migratedCount++;
              migrated.push(`Volume ${volume.id} cover`);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Volume ${volume.id}: ${message}`);
          }
        }
      }
    }

    // Check remaining
    const { count: remainingParts } = await supabase
      .from("parts")
      .select("id", { count: 'exact', head: true })
      .or("cover_image_url.like.data:%,cover_image_url_2.like.data:%");

    const { count: remainingChapters } = await supabase
      .from("chapters")
      .select("id", { count: 'exact', head: true })
      .or("cover_image_url.like.data:%,cover_image_url_2.like.data:%,cover_image_url_3.like.data:%");

    return new Response(
      JSON.stringify({ 
        success: true, 
        migratedCount,
        migrated,
        remaining: {
          parts: remainingParts || 0,
          chapters: remainingChapters || 0
        },
        errors: errors.length > 0 ? errors : undefined,
        message: `Migrated ${migratedCount} images. ${(remainingParts || 0) + (remainingChapters || 0)} remaining. Call again to continue.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Migration error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
