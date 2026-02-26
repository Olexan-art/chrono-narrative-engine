import React from 'react';
import { Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

interface Keyword {
  id: string | number;
  word: string;
  relevance_score?: number;
  category?: string;
}

interface NewsKeywordsBlockProps {
  keywords?: Keyword[] | string[];
  className?: string;
}

export function NewsKeywordsBlock({ keywords = [], className = '' }: NewsKeywordsBlockProps) {
  const { language } = useLanguage();

  // Normalize keywords to objects
  const normalizedKeywords: Keyword[] = keywords
    .filter(kw => kw !== undefined && kw !== null)
    .map((kw, index) => {
      if (typeof kw === 'string') {
        return { id: index, word: kw };
      }
      return kw;
    });

  // Sort by relevance if available
  const sortedKeywords = [...normalizedKeywords].sort((a, b) => {
    if (a.relevance_score && b.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }
    return 0;
  });

  const hasKeywords = sortedKeywords.length > 0;

  return (
    <Card className={`${className}`} data-section="keywords-visual">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tags className="w-4 h-4" />
          {language === 'uk' ? 'Ключові слова' : language === 'pl' ? 'Słowa kluczowe' : 'Keywords'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasKeywords ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sortedKeywords.map((keyword) => {
                const relevanceSize = keyword.relevance_score 
                  ? keyword.relevance_score > 0.8 ? 'lg' 
                    : keyword.relevance_score > 0.5 ? 'default' 
                    : 'sm'
                  : 'default';
                
                const relevanceVariant = keyword.relevance_score
                  ? keyword.relevance_score > 0.8 ? 'default'
                    : keyword.relevance_score > 0.5 ? 'secondary'
                    : 'outline'
                  : 'secondary';

                return (
                  <Link
                    key={keyword.id}
                    to={`/search?q=${encodeURIComponent(keyword.word)}`}
                    className="inline-block"
                  >
                    <Badge 
                      variant={relevanceVariant as any}
                      className={`
                        hover:scale-105 transition-transform cursor-pointer
                        ${relevanceSize === 'lg' ? 'text-sm px-3 py-1' : ''}
                        ${relevanceSize === 'sm' ? 'text-xs px-2 py-0.5' : ''}
                      `}
                    >
                      {keyword.word}
                      {keyword.relevance_score && (
                        <span className="ml-1 opacity-50 text-xs">
                          {Math.round(keyword.relevance_score * 100)}%
                        </span>
                      )}
                    </Badge>
                  </Link>
                );
              })}
            </div>
            {sortedKeywords.length > 15 && (
              <p className="text-xs text-muted-foreground">
                {language === 'uk' 
                  ? `Показано ${15} з ${sortedKeywords.length} ключових слів`
                  : language === 'pl'
                    ? `Pokazano ${15} z ${sortedKeywords.length} słów kluczowych`
                    : `Showing ${15} of ${sortedKeywords.length} keywords`}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <Tags className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Немає доступних ключових слів' 
                : language === 'pl' 
                  ? 'Brak dostępnych słów kluczowych' 
                  : 'No keywords available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}