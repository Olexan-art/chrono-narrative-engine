import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Library, Eye, BookOpen, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTrackView } from "@/hooks/useTrackView";

// UUID regex pattern for detecting old URLs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VolumePage() {
  const { yearMonth } = useParams<{ yearMonth: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const isUUID = yearMonth && UUID_REGEX.test(yearMonth);

  // If UUID is detected, fetch the volume to get year-month for redirect
  const { data: legacyVolume } = useQuery({
    queryKey: ['volume-legacy-redirect', yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volumes')
        .select('year, month')
        .eq('id', yearMonth)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!isUUID
  });

  // Redirect from UUID to friendly URL
  useEffect(() => {
    if (legacyVolume) {
      const newYearMonth = `${legacyVolume.year}-${String(legacyVolume.month).padStart(2, '0')}`;
      navigate(`/volume/${newYearMonth}`, { replace: true });
    }
  }, [legacyVolume, navigate]);

  // Parse year-month from URL (format: 2025-01)
  const [year, month] = isUUID ? [0, 0] : (yearMonth || '').split('-').map(Number);

  const { data: volume, isLoading } = useQuery({
    queryKey: ['volume', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volumes')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!year && !!month && !isUUID
  });

  // Fetch chapters for this volume
  const { data: chapters = [] } = useQuery({
    queryKey: ['volume-chapters', volume?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('volume_id', volume!.id)
        .order('week_of_month', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!volume?.id
  });

  // Fetch view counts
  const { data: viewCount } = useQuery({
    queryKey: ['volume-views', volume?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('view_counts')
        .select('views, unique_visitors')
        .eq('entity_type', 'volume')
        .eq('entity_id', volume!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!volume?.id
  });

  // Fetch adjacent volumes
  const { data: adjacentVolumes } = useQuery({
    queryKey: ['adjacent-volumes', year, month],
    queryFn: async () => {
      const [prevResult, nextResult] = await Promise.all([
        supabase
          .from('volumes')
          .select('year, month, title')
          .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('volumes')
          .select('year, month, title')
          .or(`year.gt.${year},and(year.eq.${year},month.gt.${month})`)
          .order('year', { ascending: true })
          .order('month', { ascending: true })
          .limit(1)
          .maybeSingle()
      ]);

      return {
        prev: prevResult.data,
        next: nextResult.data
      };
    },
    enabled: !!year && !!month
  });

  // Track view
  useTrackView('volume', volume?.id);

  // Localization helpers
  const getLocalizedTitle = (vol: any) => {
    if (language === 'en') return vol.title_en || vol.title;
    if (language === 'pl') return vol.title_pl || vol.title;
    return vol.title;
  };

  const getLocalizedDescription = (vol: any) => {
    if (language === 'en') return vol.description_en || vol.description;
    if (language === 'pl') return vol.description_pl || vol.description;
    return vol.description;
  };

  const getLocalizedSummary = (vol: any) => {
    if (language === 'en') return vol.summary_en || vol.summary;
    if (language === 'pl') return vol.summary_pl || vol.summary;
    return vol.summary;
  };

  const formatYearMonth = (y: number, m: number) => 
    `${y}-${String(m).padStart(2, '0')}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!volume) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <Library className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t('volumes.not_found') || 'Том не знайдено'}</h1>
          <p className="text-muted-foreground mb-8">
            {t('volumes.not_exists') || 'Цей том ще не існує'}
          </p>
          <Link to="/volumes">
            <Button className="gap-2">
              <Library className="w-4 h-4" />
              {t('volumes.back') || 'Повернутись до томів'}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const localizedTitle = getLocalizedTitle(volume);
  const localizedDescription = getLocalizedDescription(volume);
  const localizedSummary = getLocalizedSummary(volume);
  const canonicalUrl = `https://echoes2.com/volume/${formatYearMonth(volume.year, volume.month)}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${localizedTitle} | ${language === 'en' ? 'Synchronization Point' : language === 'pl' ? 'Punkt Synchronizacji' : 'Точка Синхронізації'}`}
        description={localizedDescription || localizedSummary || ''}
        type="article"
        image={volume.cover_image_url || undefined}
        canonicalUrl={canonicalUrl}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 font-mono">
            <Link to="/volumes" className="hover:text-primary transition-colors">
              {t('volumes.title')}
            </Link>
            <span>/</span>
            <span className="text-foreground">{t(`month.${volume.month}`)} {volume.year}</span>
          </nav>

          {/* Cover Image */}
          {volume.cover_image_url && (
            <div className="mb-8 -mx-4 md:mx-0 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
              <img 
                src={volume.cover_image_url} 
                alt={localizedTitle}
                className="w-full max-h-[400px] object-cover border-y md:border md:rounded-lg border-border"
              />
            </div>
          )}

          {/* Volume Badge */}
          <div className="flex items-center gap-2 mb-4">
            <Badge className="font-mono">
              {t('volumes.volume')} {volume.number}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {t(`month.${volume.month}`)} {volume.year}
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-glow leading-tight">
            {localizedTitle}
          </h1>

          {/* Description */}
          {localizedDescription && (
            <p className="text-xl text-muted-foreground font-serif italic mb-8 border-l-2 border-primary/30 pl-4">
              {localizedDescription}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mb-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>{viewCount?.views || 0} {t('volumes.views')}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{chapters.length} {t('chapters.count')}</span>
            </div>
          </div>

          {/* Summary */}
          {localizedSummary && (
            <Card className="cosmic-card mb-8">
              <CardHeader>
                <CardTitle className="text-lg">{t('volumes.summary') || 'Підсумок'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose font-serif text-foreground/90">
                  {localizedSummary.split('\n\n').map((p: string, i: number) => (
                    <p key={i} className="mb-4 last:mb-0">{p}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chapters */}
          {chapters.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                {t('chapters.title')}
              </h2>
              <div className="grid gap-4">
                {chapters.map((chapter: any) => {
                  const chapterTitle = language === 'en' 
                    ? (chapter.title_en || chapter.title)
                    : language === 'pl'
                    ? (chapter.title_pl || chapter.title)
                    : chapter.title;
                  
                  return (
                    <Link
                      key={chapter.id}
                      to={`/chapter/${chapter.number}`}
                      className="group"
                    >
                      <Card className="cosmic-card hover:border-primary/50 transition-all">
                        <CardContent className="p-4 flex items-center gap-4">
                          {chapter.cover_image_url && (
                            <img 
                              src={chapter.cover_image_url}
                              alt={chapterTitle}
                              className="w-16 h-16 rounded object-cover border border-border"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                {t('week')} {chapter.week_of_month}
                              </Badge>
                            </div>
                            <h3 className="font-serif font-medium group-hover:text-primary transition-colors">
                              {chapterTitle}
                            </h3>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-border pt-8">
            {adjacentVolumes?.prev ? (
              <Link to={`/volume/${formatYearMonth(adjacentVolumes.prev.year, adjacentVolumes.prev.month)}`}>
                <Button variant="outline" className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{t(`month.${adjacentVolumes.prev.month}`)} {adjacentVolumes.prev.year}</span>
                </Button>
              </Link>
            ) : (
              <div />
            )}
            
            <Link to="/volumes">
              <Button variant="ghost" size="icon">
                <Library className="w-5 h-5" />
              </Button>
            </Link>
            
            {adjacentVolumes?.next ? (
              <Link to={`/volume/${formatYearMonth(adjacentVolumes.next.year, adjacentVolumes.next.month)}`}>
                <Button variant="outline" className="gap-2">
                  <span className="hidden sm:inline">{t(`month.${adjacentVolumes.next.month}`)} {adjacentVolumes.next.year}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
