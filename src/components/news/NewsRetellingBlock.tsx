import React, { useState } from 'react';
import { BookOpen, Volume2, Pause, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

interface RetellingData {
  summary?: string;
  detailed?: string;
  bullet_points?: string[];
  readingTime?: number; // in minutes
  complexity?: 'simple' | 'intermediate' | 'advanced';
  audioUrl?: string;
}

interface NewsRetellingBlockProps {
  data?: RetellingData | string;
  className?: string;
}

export function NewsRetellingBlock({ data, className = '' }: NewsRetellingBlockProps) {
  const { language } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  // Normalize data
  const normalizedData: RetellingData = typeof data === 'string' 
    ? { summary: data }
    : data || {};

  const hasContent = normalizedData.summary || 
                    normalizedData.detailed || 
                    (normalizedData.bullet_points && normalizedData.bullet_points.length > 0);

  const getComplexityLabel = (complexity?: string) => {
    const labels: Record<string, Record<string, string>> = {
      simple: { en: 'Simple', uk: 'Простий', pl: 'Prosty' },
      intermediate: { en: 'Intermediate', uk: 'Середній', pl: 'Średni' },
      advanced: { en: 'Advanced', uk: 'Складний', pl: 'Zaawansowany' }
    };
    return labels[complexity || 'intermediate']?.[language] || labels['intermediate'][language];
  };

  const handleAudioToggle = () => {
    setIsPlaying(!isPlaying);
    // In real implementation, this would control audio playback
  };

  return (
    <Card className={`${className}`} data-section="retelling">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {language === 'uk' ? 'Переказ' : language === 'pl' ? 'Streszczenie' : 'Retelling'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {normalizedData.readingTime && (
              <Badge variant="outline" className="text-xs">
                {normalizedData.readingTime} {language === 'uk' ? 'хв' : 'min'}
              </Badge>
            )}
            {normalizedData.complexity && (
              <Badge variant="secondary" className="text-xs">
                {getComplexityLabel(normalizedData.complexity)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <div className="space-y-4">
            {normalizedData.summary && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm leading-relaxed">{normalizedData.summary}</p>
              </div>
            )}

            {normalizedData.bullet_points && normalizedData.bullet_points.length > 0 && (
              <ul className="space-y-2">
                {normalizedData.bullet_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {normalizedData.detailed && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailed(!showDetailed)}
                  className="w-full"
                >
                  {showDetailed 
                    ? language === 'uk' ? 'Сховати детальний переказ' : language === 'pl' ? 'Ukryj szczegółowe streszczenie' : 'Hide detailed retelling'
                    : language === 'uk' ? 'Показати детальний переказ' : language === 'pl' ? 'Pokaż szczegółowe streszczenie' : 'Show detailed retelling'}
                </Button>
                {showDetailed && (
                  <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t">
                    <p className="text-sm leading-relaxed">{normalizedData.detailed}</p>
                  </div>
                )}
              </>
            )}

            {normalizedData.audioUrl && (
              <div className="flex items-center gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAudioToggle}
                  className="flex items-center gap-2"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      {language === 'uk' ? 'Пауза' : language === 'pl' ? 'Pauza' : 'Pause'}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {language === 'uk' ? 'Відтворити' : language === 'pl' ? 'Odtwórz' : 'Play'}
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Volume2 className="w-3 h-3" />
                  {language === 'uk' ? 'Аудіо версія' : language === 'pl' ? 'Wersja audio' : 'Audio version'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {language === 'uk' 
                ? 'Переказ недоступний' 
                : language === 'pl' 
                  ? 'Streszczenie niedostępne' 
                  : 'Retelling not available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}