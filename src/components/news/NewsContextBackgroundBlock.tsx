import React from 'react';
import { History, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/hooks/useLanguage';

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
}

interface ContextBackgroundData {
  summary?: string;
  historical_context?: string;
  timeline?: TimelineEvent[];
  background_facts?: string[];
}

interface NewsContextBackgroundBlockProps {
  data?: ContextBackgroundData | string;
  className?: string;
}

export function NewsContextBackgroundBlock({ data, className = '' }: NewsContextBackgroundBlockProps) {
  const { language } = useLanguage();

  // Normalize data
  const normalizedData: ContextBackgroundData = typeof data === 'string' 
    ? { summary: data }
    : data || {};

  const hasContent = normalizedData.summary || 
                    normalizedData.historical_context || 
                    (normalizedData.timeline && normalizedData.timeline.length > 0) ||
                    (normalizedData.background_facts && normalizedData.background_facts.length > 0);

  return (
    <Card className={`${className}`} data-section="context-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" />
          {language === 'uk' ? 'Контекст і передумови' : language === 'pl' ? 'Kontekst i tło' : 'Context & Background'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <div className="space-y-4">
            {normalizedData.summary && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm leading-relaxed">{normalizedData.summary}</p>
              </div>
            )}

            {normalizedData.historical_context && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  {language === 'uk' ? 'Історичний контекст' : language === 'pl' ? 'Kontekst historyczny' : 'Historical Context'}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {normalizedData.historical_context}
                </p>
              </div>
            )}

            {normalizedData.timeline && normalizedData.timeline.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {language === 'uk' ? 'Хронологія подій' : language === 'pl' ? 'Chronologia wydarzeń' : 'Timeline'}
                  </h4>
                  <div className="space-y-3 relative before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                    {normalizedData.timeline.map((event, index) => (
                      <div key={index} className="flex gap-3 relative">
                        <div className="w-4 h-4 rounded-full bg-primary border-2 border-background z-10 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 -mt-0.5">
                          <div className="text-xs text-muted-foreground mb-1">{event.date}</div>
                          <div className="text-sm font-medium">{event.title}</div>
                          {event.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {normalizedData.background_facts && normalizedData.background_facts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {language === 'uk' ? 'Ключові факти' : language === 'pl' ? 'Kluczowe fakty' : 'Key Facts'}
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {normalizedData.background_facts.map((fact, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Контекст недоступний' 
                : language === 'pl' 
                  ? 'Kontekst niedostępny' 
                  : 'Context not available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}