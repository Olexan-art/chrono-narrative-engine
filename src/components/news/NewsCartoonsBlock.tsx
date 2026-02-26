import React from 'react';
import { Palette, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

interface Caricature {
  id: number;
  title: string;
  image_url: string;
  wiki_entity_id?: number | null;
  created_at?: string;
}

interface NewsCartoonsBlockProps {
  caricatures?: Caricature[];
  newsId?: number;
  entityIds?: number[];
  className?: string;
}

export function NewsCartoonsBlock({ 
  caricatures = [], 
  newsId,
  entityIds = [],
  className = ''
}: NewsCartoonsBlockProps) {
  const { language } = useLanguage();

  // If no caricatures provided, show placeholder
  const hasCaricatures = caricatures && caricatures.length > 0;

  return (
    <Card className={`${className}`} data-section="cartoon">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="w-4 h-4" />
          {language === 'uk' ? 'Карикатури' : language === 'pl' ? 'Karykatury' : 'Cartoons'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasCaricatures ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {caricatures.slice(0, 4).map(caricature => (
                <div key={caricature.id} className="relative group">
                  <img 
                    src={caricature.image_url} 
                    alt={caricature.title}
                    className="w-full h-24 object-cover rounded-lg border border-border"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs px-2 text-center line-clamp-2">
                      {caricature.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {caricatures.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{caricatures.length - 4} {language === 'uk' ? 'більше' : language === 'pl' ? 'więcej' : 'more'}
              </Badge>
            )}
            <Link 
              to="/abyss" 
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              {language === 'uk' ? 'Переглянути всі карикатури' : language === 'pl' ? 'Zobacz wszystkie karykatury' : 'View all cartoons'}
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <Palette className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Немає пов\'язаних карикатур' 
                : language === 'pl' 
                  ? 'Brak powiązanych karykatur' 
                  : 'No related cartoons'}
            </p>
            <Link 
              to="/abyss" 
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              {language === 'uk' ? 'Галерея карикатур' : language === 'pl' ? 'Galeria karykatur' : 'Cartoon gallery'}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}