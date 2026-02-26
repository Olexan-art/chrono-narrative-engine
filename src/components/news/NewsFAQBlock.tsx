import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface FAQItem {
  id?: string | number;
  question: string;
  answer: string;
  category?: string;
  popularity?: number;
}

interface NewsFAQBlockProps {
  faqs?: FAQItem[] | { question: string; answer: string }[];
  className?: string;
}

export function NewsFAQBlock({ faqs = [], className = '' }: NewsFAQBlockProps) {
  const { language } = useLanguage();
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());

  // Normalize FAQs
  const normalizedFaqs: FAQItem[] = faqs.map((faq, index) => ({
    id: (faq as FAQItem).id || index,
    question: faq.question,
    answer: faq.answer,
    category: (faq as FAQItem).category,
    popularity: (faq as FAQItem).popularity
  }));

  // Sort by popularity if available
  const sortedFaqs = [...normalizedFaqs].sort((a, b) => {
    if (a.popularity && b.popularity) {
      return b.popularity - a.popularity;
    }
    return 0;
  });

  const hasFaqs = sortedFaqs.length > 0;

  const toggleExpanded = (id: string | number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <Card className={`${className}`} data-section="faq">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          {language === 'uk' ? 'Часті запитання' : language === 'pl' ? 'Często zadawane pytania' : 'Frequently Asked Questions'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasFaqs ? (
          <div className="space-y-2">
            {sortedFaqs.map((faq) => {
              const isExpanded = expandedIds.has(faq.id!);
              return (
                <div key={faq.id} className="border rounded-lg">
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-left p-4 hover:bg-accent/50"
                    onClick={() => toggleExpanded(faq.id!)}
                  >
                    <div className="flex-1 pr-2">
                      <span className="text-sm font-medium">{faq.question}</span>
                      {faq.category && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({faq.category})
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    )}
                  </Button>
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {sortedFaqs.length > 5 && !expandedIds.size && (
              <Button
                variant="link"
                size="sm"
                className="w-full text-xs"
                onClick={() => setExpandedIds(new Set(sortedFaqs.slice(0, 5).map(f => f.id!)))}
              >
                {language === 'uk' 
                  ? 'Розкрити перші 5 питань' 
                  : language === 'pl' 
                    ? 'Rozwiń pierwsze 5 pytań' 
                    : 'Expand first 5 questions'}
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Немає доступних запитань' 
                : language === 'pl' 
                  ? 'Brak dostępnych pytań' 
                  : 'No questions available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}