import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type EntityType = 'part' | 'chapter' | 'volume';

export function useTrackView(entityType: EntityType, entityId: string | undefined) {
  useEffect(() => {
    if (!entityId) return;

    const trackView = async () => {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ entityType, entityId }),
        });
      } catch (error) {
        // Silent fail - tracking is not critical
        console.debug('View tracking failed:', error);
      }
    };

    trackView();
  }, [entityType, entityId]);
}
