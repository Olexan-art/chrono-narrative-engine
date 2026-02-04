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
  
  if (!originalContent || originalContent.length < 50) return null;
  
  // Extract domain for logo
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  
  const domain = getDomain(sourceUrl);
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
  
  // Truncate to 2000 characters (doubled)
  const truncatedContent = originalContent.length > 2000 
    ? originalContent.slice(0, 2000) + '...' 
    : originalContent;
  
  // Format content for readability: split into paragraphs
  const formatContent = (text: string) => {
    // Split by double newlines or long sentences
    const paragraphs = text
      .split(/\n\n+/)
      .flatMap(p => {
        // If paragraph is too long, split by sentences
        if (p.length > 400) {
          const sentences = p.split(/(?<=[.!?])\s+/);
          const chunks: string[] = [];
          let current = '';
          for (const s of sentences) {
            if ((current + ' ' + s).length > 350 && current) {
              chunks.push(current.trim());
              current = s;
            } else {
              current = current ? current + ' ' + s : s;
            }
          }
          if (current) chunks.push(current.trim());
          return chunks;
        }
        return [p];
      })
      .filter(p => p.trim().length > 0);
    return paragraphs;
  };
  
  const paragraphs = formatContent(truncatedContent);
  
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
          <CardContent className="pt-0 space-y-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {p}
              </p>
            ))}
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
