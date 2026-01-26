import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VolumeRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isUUID = id && UUID_REGEX.test(id);

  const { data: volume } = useQuery({
    queryKey: ['volume-redirect', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volumes')
        .select('year, month')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!isUUID
  });

  useEffect(() => {
    if (volume) {
      const yearMonth = `${volume.year}-${String(volume.month).padStart(2, '0')}`;
      // 301 redirect simulation - replace current entry
      navigate(`/volume/${yearMonth}`, { replace: true });
    } else if (id && !isUUID) {
      // Already a year-month format - redirect to proper volume page
      navigate(`/volume/${id}`, { replace: true });
    }
  }, [volume, id, isUUID, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
