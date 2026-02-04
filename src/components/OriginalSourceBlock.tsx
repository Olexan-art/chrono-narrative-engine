import { useState } from "react";
import { FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
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
  const [isOpen, setIsOpen] = useState(false);
  
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

  const toggleLabel = isOpen 
    ? (language === 'en' ? 'Hide' : language === 'pl' ? 'Ukryj' : 'Сховати')
    : (language === 'en' ? 'Show' : language === 'pl' ? 'Pokaż' : 'Показати');

  return (
    <Card className={`bg-muted/30 border-dashed ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              {title}
              {sourceName && (
                <span className="text-xs font-normal">• {sourceName}</span>
              )}
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                {toggleLabel}
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
