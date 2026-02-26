import React from 'react';
import { ArrowRight, Calendar, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

interface Prediction {
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  description: string;
  probability?: number; // 0-100
  impact?: 'low' | 'medium' | 'high';
}

interface WhatHappensNextData {
  summary?: string;
  predictions?: Prediction[];
  key_dates?: { date: string; event: string }[];
  watch_for?: string[];
}

interface NewsWhatHappensNextBlockProps {
  data?: WhatHappensNextData | string;
  className?: string;
}

export function NewsWhatHappensNextBlock({ data, className = '' }: NewsWhatHappensNextBlockProps) {
  const { language } = useLanguage();

  // Normalize data
  const normalizedData: WhatHappensNextData = typeof data === 'string' 
    ? { summary: data }
    : data || {};

  const hasContent = normalizedData.summary || 
                    (normalizedData.predictions && normalizedData.predictions.length > 0) ||
                    (normalizedData.key_dates && normalizedData.key_dates.length > 0) ||
                    (normalizedData.watch_for && normalizedData.watch_for.length > 0);

  const getTimeframeLabel = (timeframe: string) => {
    const labels: Record<string, Record<string, string>> = {
      immediate: { en: 'Immediate', uk: 'Негайно', pl: 'Natychmiast' },
      'short-term': { en: 'Short-term', uk: 'Короткострокова', pl: 'Krótkoterminowe' },
      'medium-term': { en: 'Medium-term', uk: 'Середньострокова', pl: 'Średnioterminowe' },
      'long-term': { en: 'Long-term', uk: 'Довгострокова', pl: 'Długoterminowe' }
    };
    return labels[timeframe]?.[language] || labels[timeframe]?.['en'] || timeframe;
  };

  const getImpactColor = (impact?: string) => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card className={`${className}`} data-section="what-happens-next">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          {language === 'uk' ? 'Що далі' : language === 'pl' ? 'Co dalej' : 'What Happens Next'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <div className="space-y-4">
            {normalizedData.summary && (
              <p className="text-sm leading-relaxed">{normalizedData.summary}</p>
            )}

            {normalizedData.predictions && normalizedData.predictions.length > 0 && (
              <div className="space-y-3">
                {normalizedData.predictions.map((prediction, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 bg-accent/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {getTimeframeLabel(prediction.timeframe)}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {prediction.probability && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {prediction.probability}%
                          </span>
                        )}
                        {prediction.impact && (
                          <Badge variant={getImpactColor(prediction.impact) as any} className="text-xs">
                            {prediction.impact}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">{prediction.description}</p>
                  </div>
                ))}
              </div>
            )}

            {normalizedData.key_dates && normalizedData.key_dates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {language === 'uk' ? 'Ключові дати' : language === 'pl' ? 'Kluczowe daty' : 'Key Dates'}
                </h4>
                <div className="space-y-2">
                  {normalizedData.key_dates.map((item, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[80px]">{item.date}</span>
                      <span>{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {normalizedData.watch_for && normalizedData.watch_for.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-3 h-3" />
                  {language === 'uk' ? 'На що звернути увагу' : language === 'pl' ? 'Na co zwrócić uwagę' : 'Watch For'}
                </h4>
                <ul className="space-y-1">
                  {normalizedData.watch_for.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <ArrowRight className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Прогноз недоступний' 
                : language === 'pl' 
                  ? 'Prognoza niedostępna' 
                  : 'Predictions not available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}