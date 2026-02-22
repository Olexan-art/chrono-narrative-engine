import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type EntityType = 'part' | 'chapter' | 'volume' | 'news' | 'wiki';

export function useTrackView(entityType: EntityType, entityId: string | undefined) {
  useEffect(() => {
    if (!entityId) return;

    const trackView = async () => {
      try {
        const visitorId = localStorage.getItem('visitor_id') || (() => {
          const id = crypto.randomUUID();
          localStorage.setItem('visitor_id', id);
          return id;
        })();

        await supabase.functions.invoke('track-view', {
          body: { entityType, entityId, visitor_id: visitorId },
          headers: { 'x-visitor-id': visitorId },
        });
      } catch (error) {
        // Silent fail - tracking is not critical
        console.debug('View tracking failed:', error);
      }
    };

    trackView();
  }, [entityType, entityId]);
}
