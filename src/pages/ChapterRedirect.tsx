import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChapterRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isUUID = id && UUID_REGEX.test(id);

  const { data: chapter } = useQuery({
    queryKey: ['chapter-redirect', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('number')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!isUUID
  });

  useEffect(() => {
    if (chapter?.number) {
      // 301 redirect simulation - replace current entry to avoid back button issues
      navigate(`/chapter/${chapter.number}`, { replace: true });
    } else if (id && !isUUID) {
      // Already a number - redirect to proper chapter page
      navigate(`/chapter/${id}`, { replace: true });
    }
  }, [chapter, id, isUUID, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
