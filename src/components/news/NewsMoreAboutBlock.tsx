import React from 'react';
import { Newspaper, Calendar, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

interface RelatedArticle {
  id: number | string;
  title: string;
  url?: string;
  date?: string;
  source?: string;
  relevance_score?: number;
  entity_overlap?: number;
}

interface NewsMoreAboutBlockProps {
  articles?: RelatedArticle[];
  entityName?: string;
  entityId?: number;
  className?: string;
}

export function NewsMoreAboutBlock({ 
  articles = [], 
  entityName,
  entityId,
  className = '' 
}: NewsMoreAboutBlockProps) {
  const { language } = useLanguage();

  // Sort by relevance score or entity overlap
  const sortedArticles = [...articles].sort((a, b) => {
    if (a.relevance_score && b.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }
    if (a.entity_overlap && b.entity_overlap) {
      return b.entity_overlap - a.entity_overlap;
    }
    return 0;
  });

  const safeArticles = sortedArticles.filter(a => a && a.id !== undefined && a.title);
  const hasArticles = safeArticles.length > 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(
      language === 'uk' ? 'uk-UA' : language === 'pl' ? 'pl-PL' : 'en-US',
      { month: 'short', day: 'numeric' }
    );
  };

  return (
    <Card className={`${className}`} data-section="more-news-about">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          {language === 'uk' 
            ? `Більше новин${entityName ? ` про ${entityName}` : ''}` 
            : language === 'pl' 
              ? `Więcej wiadomości${entityName ? ` o ${entityName}` : ''}`
              : `More news${entityName ? ` about ${entityName}` : ''}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasArticles ? (
          <div className="space-y-3">
            {safeArticles.slice(0, 6).map((article) => (
              <div key={article.id} className="group">
                <Link
                  to={article.url || `/news/${article.id}`}
                  className="block p-2 -mx-2 hover:bg-accent/50 rounded-md transition-colors"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary">
                      {article.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {article.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(article.date)}
                        </span>
                      )}
                      {article.source && (
                        <span>{article.source}</span>
                      )}
                      {article.relevance_score && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(article.relevance_score * 100)}% match
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            
            {safeArticles.length > 6 && (
              <div className="pt-2 text-center">
                <Link 
                  to={entityId ? `/entities/${entityId}/news` : `/search?q=${encodeURIComponent(entityName || '')}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {language === 'uk' 
                    ? `Всі новини (${safeArticles.length})` 
                    : language === 'pl'
                      ? `Wszystkie wiadomości (${safeArticles.length})`
                      : `All news (${safeArticles.length})`}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <Newspaper className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'uk' 
                ? 'Немає пов\'язаних новин' 
                : language === 'pl' 
                  ? 'Brak powiązanych wiadomości' 
                  : 'No related news'}
            </p>
            {entityName && (
              <Link 
                to={`/search?q=${encodeURIComponent(entityName)}`}
                className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {language === 'uk' ? 'Шукати новини' : language === 'pl' ? 'Szukaj wiadomości' : 'Search news'}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}