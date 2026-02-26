import React from 'react';
import { Compass, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { Link } from 'react-router-dom';

interface Topic {
  id: string | number;
  name: string;
  slug?: string;
  count?: number;
  relevance?: number;
}

interface NewsTopicsNavBlockProps {
  topics?: Topic[] | string[];
  className?: string;
}

export function NewsTopicsNavBlock({ topics = [], className = '' }: NewsTopicsNavBlockProps) {
  const { language } = useLanguage();

  // Normalize topics
  const normalizedTopics: Topic[] = topics.map((topic, index) => {
    if (typeof topic === 'string') {
      return { 
        id: index, 
        name: topic,
        slug: topic.toLowerCase().replace(/\s+/g, '-')
      };
    }
    return {
      ...topic,
      slug: topic.slug || topic.name.toLowerCase().replace(/\s+/g, '-')
    };
  });

  // Sort by relevance or count
  const sortedTopics = [...normalizedTopics].sort((a, b) => {
    if (a.relevance && b.relevance) return b.relevance - a.relevance;
    if (a.count && b.count) return b.count - a.count;
    return 0;
  });

  const hasTopics = sortedTopics.length > 0;

  return (
    <Card className={`${className}`} data-section="topics-nav">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="w-4 h-4" />
          {language === 'uk' ? 'Пов\'язані теми' : language === 'pl' ? 'Powiązane tematy' : 'Related Topics'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasTopics ? (
          <div className="space-y-2">
            {sortedTopics.slice(0, 8).map((topic) => (
              <Link
                key={topic.id}
                to={`/topics/${topic.slug}`}
                className="block"
              >
                <Button
                  variant="ghost"
                  className="w-full justify-between text-sm hover:bg-accent/50"
                >
                  <span className="truncate">{topic.name}</span>
                  <div className="flex items-center gap-1">
                    {topic.count && (
                      <span className="text-xs text-muted-foreground">
                        {topic.count}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Button>
              </Link>
            ))}
            {sortedTopics.length > 8 && (
              <Link to="/topics" className="block">
                <Button variant="outline" className="w-full text-sm">
                  {language === 'uk' 
                    ? `Всі теми (${sortedTopics.length})` 
                    : language === 'pl'
                      ? `Wszystkie tematy (${sortedTopics.length})`
                      : `All topics (${sortedTopics.length})`}
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <Compass className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'uk' 
                ? 'Немає пов\'язаних тем' 
                : language === 'pl' 
                  ? 'Brak powiązanych tematów' 
                  : 'No related topics'}
            </p>
            <Link to="/topics">
              <Button variant="outline" size="sm">
                {language === 'uk' ? 'Переглянути всі теми' : language === 'pl' ? 'Zobacz wszystkie tematy' : 'Browse all topics'}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}