import { useState } from "react";
import { FileText, ExternalLink, Edit3, Save, X, Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";

interface OriginalSourceBlockProps {
  originalContent: string | null;
  sourceUrl: string;
  sourceName?: string;
  className?: string;
  isAdmin?: boolean;
  newsId?: string;
  onContentUpdate?: () => void;
}

// Decode HTML entities for display
function decodeHtmlEntities(text: string): string {
  // Decode numeric entities (&#322; &#261; &#380; etc.)
  let decoded = text.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Decode hex entities (&#x142; etc.)
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  // Named entities map
  const namedEntities: Record<string, string> = {
    'nbsp': ' ',
    'amp': '&',
    'lt': '<',
    'gt': '>',
    'quot': '"',
    'apos': "'",
    'ndash': '\u2013',
    'mdash': '\u2014',
    'lsquo': '\u2018',
    'rsquo': '\u2019',
    'ldquo': '\u201C',
    'rdquo': '\u201D',
    'hellip': '…',
    'copy': '©',
    'reg': '®',
    'trade': '™',
  };
  
  // Decode named entities
  decoded = decoded.replace(/&([a-zA-Z]+);/g, (match, name) => {
    return namedEntities[name] || match;
  });
  
  return decoded;
}

export function OriginalSourceBlock({ 
  originalContent, 
  sourceUrl, 
  sourceName,
  className = "",
  isAdmin = false,
  newsId,
  onContentUpdate
}: OriginalSourceBlockProps) {
  const { language } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(originalContent || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  
  if (!originalContent || originalContent.length < 50) return null;
  
  // Decode HTML entities
  const decodedContent = decodeHtmlEntities(originalContent);
  
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
  const truncatedContent = decodedContent.length > 2000 
    ? decodedContent.slice(0, 2000) + '...' 
    : decodedContent;
  
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

  const toggleLabel = language === 'en' ? 'Toggle' : language === 'pl' ? 'Przełącz' : 'Згорнути';

  const handleSave = async () => {
    if (!newsId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('news_rss_items')
        .update({ original_content: editedContent })
        .eq('id', newsId);
      
      if (error) throw error;
      
      toast.success(
        language === 'en' ? 'Content saved' : 
        language === 'pl' ? 'Treść zapisana' : 
        'Контент збережено'
      );
      setIsEditing(false);
      onContentUpdate?.();
    } catch (error) {
      toast.error(
        language === 'en' ? 'Failed to save' : 
        language === 'pl' ? 'Błąd zapisu' : 
        'Помилка збереження'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(originalContent || '');
    setIsEditing(false);
  };

  const handleStructureText = async () => {
    if (!newsId) return;
    
    setIsStructuring(true);
    try {
      const result = await callEdgeFunction<{
        success: boolean;
        content: string;
        error?: string;
      }>('structure-text', {
        newsId,
        content: editedContent || decodedContent
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to structure text');
      }
      
      // Update in database
      const { error } = await supabase
        .from('news_rss_items')
        .update({ original_content: result.content })
        .eq('id', newsId);
      
      if (error) throw error;
      
      toast.success(
        language === 'en' ? 'Text structured and cleaned' : 
        language === 'pl' ? 'Tekst uporządkowany' : 
        'Текст структуровано та очищено'
      );
      setIsEditing(false);
      onContentUpdate?.();
    } catch (error) {
      console.error('Error structuring text:', error);
      toast.error(error instanceof Error ? error.message : 'Error structuring text');
    } finally {
      setIsStructuring(false);
    }
  };

  return (
    <Card className={`bg-muted/30 border-dashed relative overflow-hidden ${className}`}>
      {/* Watermark logo */}
      {logoUrl && !isEditing && (
        <div 
          className="absolute bottom-4 right-4 pointer-events-none z-0"
          style={{ width: '30%', opacity: 0.12 }}
        >
          <img 
            src={logoUrl} 
            alt=""
            className="w-full h-auto object-contain"
            loading="lazy"
          />
        </div>
      )}
      <Collapsible defaultOpen={true}>
        <CardHeader className="pb-2 relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              {title}
              {sourceName && (
                <span className="text-xs font-normal">• {sourceName}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isAdmin && newsId && !isEditing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => {
                    setEditedContent(decodedContent);
                    setIsEditing(true);
                  }}
                >
                  <Edit3 className="w-3 h-3" />
                  {language === 'en' ? 'Edit' : language === 'pl' ? 'Edytuj' : 'Редагувати'}
                </Button>
              )}
              {!isEditing && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                    {toggleLabel}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3 relative z-10">
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[300px] text-sm font-mono"
                  placeholder="Оригінальний контент..."
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {editedContent.length} {language === 'en' ? 'characters' : language === 'pl' ? 'znaków' : 'символів'}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="w-3 h-3 mr-1" />
                      {language === 'en' ? 'Cancel' : language === 'pl' ? 'Anuluj' : 'Скасувати'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
                      )}
                      {language === 'en' ? 'Save' : language === 'pl' ? 'Zapisz' : 'Зберегти'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
