import React from 'react';
import { AlertCircle, TrendingUp, Globe, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

interface WhyItMattersData {
  text?: string;
  impacts?: {
    type: 'economic' | 'social' | 'political' | 'global' | 'local';
    description: string;
  }[];
  significance?: number; // 1-10 scale
}

interface NewsWhyItMattersBlockProps {
  data?: WhyItMattersData | string;
  className?: string;
}

export function NewsWhyItMattersBlock({ data, className = '' }: NewsWhyItMattersBlockProps) {
  const { language } = useLanguage();

  // Normalize data
  const normalizedData: WhyItMattersData = typeof data === 'string' 
    ? { text: data }
    : data || {};

  const hasContent = normalizedData.text || (normalizedData.impacts && normalizedData.impacts.length > 0);

  const getImpactIcon = (type: string) => {
    switch (type) {
      case 'economic': return <TrendingUp className="w-4 h-4" />;
      case 'global': return <Globe className="w-4 h-4" />;
      case 'social': return <Users className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getImpactLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      economic: { en: 'Economic Impact', uk: 'Економічний вплив', pl: 'Wpływ ekonomiczny' },
      social: { en: 'Social Impact', uk: 'Соціальний вплив', pl: 'Wpływ społeczny' },
      political: { en: 'Political Impact', uk: 'Політичний вплив', pl: 'Wpływ polityczny' },
      global: { en: 'Global Impact', uk: 'Глобальний вплив', pl: 'Wpływ globalny' },
      local: { en: 'Local Impact', uk: 'Місцевий вплив', pl: 'Wpływ lokalny' }
    };
    return labels[type]?.[language] || labels[type]?.['en'] || type;
  };

  return (
    <Card className={`${className}`} data-section="why-it-matters">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {language === 'uk' ? 'Чому це важливо' : language === 'pl' ? 'Dlaczego to ważne' : 'Why It Matters'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <div className="space-y-4">
            {normalizedData.text && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm leading-relaxed">{normalizedData.text}</p>
              </div>
            )}
            
            {normalizedData.impacts && normalizedData.impacts.length > 0 && (
              <div className="space-y-3 pt-2">
                {normalizedData.impacts.map((impact, index) => (
                  <div key={index} className="flex gap-3 p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center gap-2 text-primary">
                      {getImpactIcon(impact.type)}
                      <span className="text-xs font-medium">
                        {getImpactLabel(impact.type)}
                      </span>
                    </div>
                    <p className="text-sm flex-1">{impact.description}</p>
                  </div>
                ))}
              </div>
            )}

            {normalizedData.significance && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-muted-foreground">
                  {language === 'uk' ? 'Рівень важливості:' : language === 'pl' ? 'Poziom ważności:' : 'Significance level:'}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i < normalizedData.significance! 
                          ? 'bg-primary' 
                          : 'bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Аналіз важливості недоступний' 
                : language === 'pl' 
                  ? 'Analiza ważności niedostępna' 
                  : 'Importance analysis not available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}