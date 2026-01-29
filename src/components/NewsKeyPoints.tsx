import { Lightbulb, Tag, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewsKeyPointsProps {
  keyPoints: string[];
  themes: string[];
  keywords: string[];
  isUkrainian?: boolean;
  keyPointsEn?: string[];
  themesEn?: string[];
}

export function NewsKeyPoints({ 
  keyPoints, 
  themes, 
  keywords, 
  isUkrainian = false,
  keyPointsEn = [],
  themesEn = []
}: NewsKeyPointsProps) {
  const { t, language } = useLanguage();
  
  const hasContent = keyPoints.length > 0 || themes.length > 0;
  const hasEnglishContent = keyPointsEn.length > 0 || themesEn.length > 0;
  
  if (!hasContent) return null;

  const getTitle = () => {
    if (language === 'en') return 'Key Takeaways';
    if (language === 'pl') return 'Główne wnioski';
    return 'Головні тези';
  };

  const getThemesLabel = () => {
    if (language === 'en') return 'Topics';
    if (language === 'pl') return 'Tematy';
    return 'Теми';
  };

  // For Ukrainian news, show bilingual content
  if (isUkrainian && hasEnglishContent) {
    return (
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="w-5 h-5 text-primary" />
            {getTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* English Key Points */}
          {keyPointsEn.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs font-semibold bg-blue-500/10 text-blue-400 border-blue-500/30">
                  EN
                </Badge>
              </div>
              <ul className="space-y-2 pl-1">
                {keyPointsEn.map((point, index) => (
                  <li key={`en-${index}`} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-foreground/90 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ukrainian Key Points */}
          {keyPoints.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs font-semibold bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                  UA
                </Badge>
              </div>
              <ul className="space-y-2 pl-1">
                {keyPoints.map((point, index) => (
                  <li key={`ua-${index}`} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-foreground/90 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Themes - bilingual */}
          {(themes.length > 0 || themesEn.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {getThemesLabel()}:
              </span>
              {themesEn.map((theme, index) => (
                <Badge 
                  key={`theme-en-${index}`} 
                  variant="secondary"
                  className="text-xs font-medium bg-blue-500/10 text-blue-300"
                >
                  {theme}
                </Badge>
              ))}
              {themes.map((theme, index) => (
                <Badge 
                  key={`theme-ua-${index}`} 
                  variant="secondary"
                  className="text-xs font-medium bg-yellow-500/10 text-yellow-300"
                >
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default single-language display
  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Lightbulb className="w-5 h-5 text-primary" />
          {getTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Points */}
        {keyPoints.length > 0 && (
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li 
                key={index}
                className="flex items-start gap-3 text-sm"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-foreground/90 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Themes */}
        {themes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {getThemesLabel()}:
            </span>
            {themes.map((theme, index) => (
              <Badge 
                key={index} 
                variant="secondary"
                className="text-xs font-medium"
              >
                {theme}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NewsKeywordsProps {
  keywords: string[];
}

export function NewsKeywords({ keywords }: NewsKeywordsProps) {
  const { language } = useLanguage();
  
  if (!keywords || keywords.length === 0) return null;

  const getLabel = () => {
    if (language === 'en') return 'Keywords';
    if (language === 'pl') return 'Słowa kluczowe';
    return 'Ключові слова';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
        <Search className="w-3 h-3" />
        {getLabel()}:
      </span>
      {keywords.map((keyword, index) => (
        <Badge 
          key={index} 
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground hover:text-foreground transition-colors"
        >
          {keyword}
        </Badge>
      ))}
    </div>
  );
}
