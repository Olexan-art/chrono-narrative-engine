import { useQuery } from "@tanstack/react-query";
import { Library, Eye, BookOpen, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function VolumesPage() {
  const { t, language } = useLanguage();
  
  const pageTitle = language === 'en' ? 'Volumes Archive' : language === 'pl' ? 'Archiwum tomów' : 'Архів томів';
  const pageDescription = language === 'en' 
    ? 'Monthly volumes collecting weekly chapters of AI-generated science fiction narratives' 
    : language === 'pl' 
    ? 'Miesięczne tomy zbierające tygodniowe rozdziały narracji science fiction generowanych przez AI'
    : 'Місячні томи, що збирають тижневі глави наративів наукової фантастики, згенерованих ШІ';

  const { data: volumes = [], isLoading } = useQuery({
    queryKey: ['volumes-with-stats', language],
    queryFn: async () => {
      // Fetch all volumes
      const { data: volumesData, error: volumesError } = await supabase
        .from('volumes')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (volumesError) throw volumesError;

      // Fetch view counts for volumes
      const { data: viewCounts } = await supabase
        .from('view_counts')
        .select('entity_id, views, unique_visitors')
        .eq('entity_type', 'volume');

      // Fetch chapters count per volume
      const { data: chapters } = await supabase
        .from('chapters')
        .select('volume_id');

      // Map view counts
      const viewsMap = new Map(
        (viewCounts || []).map(vc => [vc.entity_id, { views: vc.views, unique: vc.unique_visitors }])
      );

      // Count chapters per volume
      const chaptersMap = new Map<string, number>();
      (chapters || []).forEach(ch => {
        chaptersMap.set(ch.volume_id, (chaptersMap.get(ch.volume_id) || 0) + 1);
      });

      return (volumesData || []).map(volume => ({
        ...volume,
        views: viewsMap.get(volume.id)?.views || 0,
        uniqueVisitors: viewsMap.get(volume.id)?.unique || 0,
        chaptersCount: chaptersMap.get(volume.id) || 0,
      }));
    }
  });

  // Localize volume data
  const getLocalizedTitle = (volume: any) => {
    if (language === 'en') return volume.title_en || volume.title;
    if (language === 'pl') return volume.title_pl || volume.title;
    return volume.title;
  };

  const getLocalizedDescription = (volume: any) => {
    if (language === 'en') return volume.description_en || volume.description;
    if (language === 'pl') return volume.description_pl || volume.description;
    return volume.description;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl="https://echoes2.com/volumes"
        keywords={['volumes', 'monthly', 'archive', 'AI', 'science fiction', 'томи', 'архів']}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <Library className="w-8 h-8 text-primary" />
            {t('volumes.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('volumes.description')}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="cosmic-card animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : volumes.length === 0 ? (
          <Card className="cosmic-card">
            <CardContent className="py-12 text-center">
              <Library className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('volumes.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {volumes.map(volume => (
              <Card key={volume.id} className="cosmic-card hover:border-primary/50 transition-all group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        {t('volumes.volume')} {volume.number}
                      </Badge>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {getLocalizedTitle(volume)}
                      </CardTitle>
                    </div>
                    {volume.cover_image_url && (
                      <img 
                        src={volume.cover_image_url} 
                        alt={getLocalizedTitle(volume)}
                        className="w-16 h-16 rounded-lg object-cover border border-border"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{t(`month.${volume.month}`)} {volume.year}</span>
                  </div>

                  {getLocalizedDescription(volume) && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {getLocalizedDescription(volume)}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4 text-primary" />
                        <span className="font-mono">{volume.views}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <span>{volume.chaptersCount} {t('chapters.count')}</span>
                      </div>
                    </div>
                  </div>

                  <Link 
                    to={`/volume/${volume.year}-${String(volume.month).padStart(2, '0')}`}
                    className="block text-sm text-primary hover:underline"
                  >
                    {t('volumes.view_chapters')}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary stats */}
        {volumes.length > 0 && (
          <Card className="cosmic-card mt-8">
            <CardContent className="py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">{volumes.length}</p>
                  <p className="text-sm text-muted-foreground">{t('volumes.title')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{volumes.reduce((sum, v) => sum + v.chaptersCount, 0)}</p>
                  <p className="text-sm text-muted-foreground">{t('chapters.count')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{volumes.reduce((sum, v) => sum + v.views, 0)}</p>
                  <p className="text-sm text-muted-foreground">{t('volumes.views')}</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{volumes.reduce((sum, v) => sum + v.uniqueVisitors, 0)}</p>
                  <p className="text-sm text-muted-foreground">{t('volumes.unique')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
