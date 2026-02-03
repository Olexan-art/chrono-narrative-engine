import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface OriginalSourceBlockProps {
  originalContent: string | null;
  sourceUrl: string;
  sourceName?: string;
  className?: string;
}

export function OriginalSourceBlock({ 
  originalContent, 
  sourceUrl, 
  sourceName,
  className = "" 
}: OriginalSourceBlockProps) {
  const { language } = useLanguage();
  
  if (!originalContent || originalContent.length < 50) return null;
  
  // Truncate to 1000 characters
  const truncatedContent = originalContent.length > 1000 
    ? originalContent.slice(0, 1000) + '...' 
    : originalContent;
  
  const title = language === 'en' 
    ? 'Original Source' 
    : language === 'pl' 
    ? 'Oryginalne źródło' 
    : 'Оригінал новини';
  
  const readMoreLabel = language === 'en' 
    ? 'Read full article at source' 
    : language === 'pl' 
    ? 'Przeczytaj pełny artykuł' 
    : 'Читати повністю на джерелі';

  return (
    <Card className={`bg-muted/30 border-dashed ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <FileText className="w-4 h-4" />
          {title}
          {sourceName && (
            <span className="text-xs font-normal">• {sourceName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {truncatedContent}
        </p>
        <a 
          href={sourceUrl} 
          target="_blank" 
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {readMoreLabel}
        </a>
      </CardContent>
    </Card>
  );
}
