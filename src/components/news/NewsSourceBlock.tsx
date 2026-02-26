import React from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsSourceBlockProps {
  sourceUrl?: string;
  sourceName?: string;
  feedCategory?: string;
  publishedAt?: string;
  className?: string;
}

export function NewsSourceBlock({ 
  sourceUrl, 
  sourceName, 
  feedCategory,
  publishedAt,
  className = ''
}: NewsSourceBlockProps) {
  const { language } = useLanguage();

  if (!sourceName) return null;

  return (
    <Card className={`${className}`} data-section="source">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          {language === 'uk' ? 'Джерело' : language === 'pl' ? 'Źródło' : 'Source'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-medium">
            {sourceName}
          </Badge>
          {feedCategory && (
            <Badge variant="outline" className="text-xs">
              {feedCategory}
            </Badge>
          )}
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            {language === 'uk' ? 'Перейти до оригіналу' : language === 'pl' ? 'Przejdź do oryginału' : 'Go to original'}
          </a>
        )}
        {publishedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            {language === 'uk' ? 'Опубліковано' : language === 'pl' ? 'Opublikowano' : 'Published'}: {new Date(publishedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}