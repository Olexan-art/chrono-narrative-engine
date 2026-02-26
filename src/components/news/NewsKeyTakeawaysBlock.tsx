import React from 'react';
import { Lightbulb, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';

interface NewsKeyTakeawaysBlockProps {
  takeaways?: string[] | { id?: string | number; text: string; priority?: number }[];
  className?: string;
}

export function NewsKeyTakeawaysBlock({ takeaways = [], className = '' }: NewsKeyTakeawaysBlockProps) {
  const { language } = useLanguage();

  // Normalize takeaways
  const normalizedTakeaways = takeaways.map((takeaway, index) => {
    if (typeof takeaway === 'string') {
      return { id: index, text: takeaway, priority: 0 };
    }
    return { ...takeaway, id: takeaway.id || index };
  });

  // Sort by priority if available
  const sortedTakeaways = [...normalizedTakeaways].sort((a, b) => {
    if (a.priority !== undefined && b.priority !== undefined) {
      return b.priority - a.priority;
    }
    return 0;
  });

  const hasTakeaways = sortedTakeaways.length > 0;

  return (
    <Card className={`${className}`} data-section="key-takeaways">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          {language === 'uk' ? 'Ключові висновки' : language === 'pl' ? 'Kluczowe wnioski' : 'Key Takeaways'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasTakeaways ? (
          <ul className="space-y-3">
            {sortedTakeaways.map((takeaway) => (
              <li key={takeaway.id} className="flex gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{takeaway.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Основні висновки недоступні' 
                : language === 'pl' 
                  ? 'Kluczowe wnioski niedostępne' 
                  : 'Key takeaways not available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}