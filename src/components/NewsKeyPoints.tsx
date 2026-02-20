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

// Separate Key Takeaways Card component
function KeyTakeawaysCard({ 
  points, 
  themes, 
  title, 
  lang, 
  badgeColor 
}: { 
  points: string[];
  themes?: string[];
  title: string;
  lang: 'en' | 'uk';
  badgeColor: 'blue' | 'yellow';
}) {
  const { language } = useLanguage();
  
  const getThemesLabel = () => {
    if (language === 'en') return 'Topics';
    if (language === 'pl') return 'Tematy';
    return 'Теми';
  };

  const badgeClasses = badgeColor === 'blue' 
    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';

  const pointBgClasses = badgeColor === 'blue'
    ? 'bg-blue-500/10 text-blue-400'
    : 'bg-yellow-500/10 text-yellow-400';

  const themeBgClasses = badgeColor === 'blue'
    ? 'bg-blue-500/10 text-blue-300'
    : 'bg-yellow-500/10 text-yellow-300';

  return (
    <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" itemScope itemType="https://schema.org/ItemList">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          <span className="flex items-center gap-2" itemProp="name">
            <Lightbulb className="w-5 h-5 text-primary" />
            {title}
          </span>
          <Badge variant="outline" className={`text-xs font-semibold ${badgeClasses}`}>
            {lang === 'en' ? 'EN' : 'UA'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {points.map((point, index) => (
            <li key={index} className="flex items-start gap-3 text-sm" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <meta itemProp="position" content={String(index + 1)} />
              <span className={`flex-shrink-0 w-6 h-6 rounded-full ${pointBgClasses} flex items-center justify-center text-xs font-bold`}>
                {index + 1}
              </span>
              <span className="text-foreground/90 leading-relaxed" itemProp="name">{point}</span>
            </li>
          ))}
        </ul>

        {themes && themes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {getThemesLabel()}:
            </span>
            {themes.map((theme, index) => (
              <Badge 
                key={index} 
                variant="secondary"
                className={`text-xs font-medium ${themeBgClasses}`}
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

export function NewsKeyPoints({ 
  keyPoints, 
  themes, 
  keywords, 
  isUkrainian = false,
  keyPointsEn = [],
  themesEn = []
}: NewsKeyPointsProps) {
  const { language } = useLanguage();
  
  const hasUkrainianContent = keyPoints.length > 0;
  const hasEnglishContent = keyPointsEn.length > 0;
  
  if (!hasUkrainianContent && !hasEnglishContent) return null;

  // For Ukrainian news, show two separate blocks: English first, then Ukrainian
  if (isUkrainian) {
    return (
      <div className="space-y-4 mb-6">
        {/* English Key Takeaways - FIRST */}
        {hasEnglishContent && (
          <KeyTakeawaysCard 
            points={keyPointsEn}
            themes={themesEn}
            title="Key Takeaways"
            lang="en"
            badgeColor="blue"
          />
        )}

        {/* Ukrainian Key Takeaways - SECOND */}
        {hasUkrainianContent && (
          <KeyTakeawaysCard 
            points={keyPoints}
            themes={themes}
            title="Головні тези"
            lang="uk"
            badgeColor="yellow"
          />
        )}
      </div>
    );
  }

  // Default single-language display for non-Ukrainian news
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

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" itemScope itemType="https://schema.org/ItemList">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold" itemProp="name">
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
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <meta itemProp="position" content={String(index + 1)} />
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-foreground/90 leading-relaxed" itemProp="name">{point}</span>
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
          <meta itemProp="keywords" content={keyword} />
          {keyword}
        </Badge>
      ))}
    </div>
  );
}
