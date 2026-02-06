import { useState } from "react";
import { ImagePlus, RefreshCw, Loader2, Sparkles, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { callEdgeFunction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewsImageBlockProps {
  imageUrl: string | null;
  newsId: string;
  title: string;
  keywords?: string[];
  themes?: string[];
  keyPoints?: any[];
  hasRetelling: boolean;
  isAdmin: boolean;
  onImageUpdate?: () => void;
}

// Image styles
const IMAGE_STYLES = [
  { value: 'realistic', label: 'Реалістичний', labelEn: 'Realistic', labelPl: 'Realistyczny', prompt: 'photorealistic, editorial photography, professional journalism style' },
  { value: 'illustration', label: 'Ілюстрація', labelEn: 'Illustration', labelPl: 'Ilustracja', prompt: 'digital illustration, editorial art, clean vector-like style, modern design' },
  { value: 'caricature', label: 'Карикатура', labelEn: 'Caricature', labelPl: 'Karykatura', prompt: 'satirical caricature, exaggerated features, political cartoon style, expressive' },
  { value: 'anime', label: 'Аніме', labelEn: 'Anime', labelPl: 'Anime', prompt: '90s anime style, cel-shaded, vibrant colors, dynamic composition' },
  { value: 'noir', label: 'Нуар', labelEn: 'Noir', labelPl: 'Noir', prompt: 'film noir style, dramatic shadows, black and white with high contrast, mysterious atmosphere' },
];

export function NewsImageBlock({
  imageUrl,
  newsId,
  title,
  keywords = [],
  themes = [],
  keyPoints = [],
  hasRetelling,
  isAdmin,
  onImageUpdate
}: NewsImageBlockProps) {
  const { language } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('realistic');

  const getStyleLabel = (style: typeof IMAGE_STYLES[0]) => {
    return language === 'en' ? style.labelEn : language === 'pl' ? style.labelPl : style.label;
  };

  const buildPrompt = () => {
    const parts: string[] = [];
    
    // Title as main context
    parts.push(`News headline: "${title}"`);
    
    // Keywords
    if (keywords.length > 0) {
      parts.push(`Keywords: ${keywords.slice(0, 5).join(', ')}`);
    }
    
    // Themes/Topics
    if (themes.length > 0) {
      parts.push(`Topics: ${themes.slice(0, 3).join(', ')}`);
    }
    
    // Key takeaways
    if (keyPoints.length > 0) {
      const points = keyPoints.slice(0, 2).map(p => 
        typeof p === 'string' ? p : (p as any).point || (p as any).text || ''
      ).filter(Boolean);
      if (points.length > 0) {
        parts.push(`Key points: ${points.join('; ')}`);
      }
    }

    // Get style prompt
    const styleConfig = IMAGE_STYLES.find(s => s.value === selectedStyle) || IMAGE_STYLES[0];

    return `Create a news article illustration based on: ${parts.join('. ')}. 
Style: ${styleConfig.prompt}. High quality, 16:9 aspect ratio.`;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const prompt = buildPrompt();
      console.log('Generating news image with prompt:', prompt);
      
      const result = await callEdgeFunction<{
        success: boolean;
        imageUrl: string;
        error?: string;
      }>('generate-image', {
        prompt,
        newsId
      });
      
      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Failed to generate image');
      }
      
      // Update news item with new image
      const { error } = await supabase
        .from('news_rss_items')
        .update({ image_url: result.imageUrl })
        .eq('id', newsId);
      
      if (error) throw error;
      
      toast.success(
        language === 'en' ? 'Image generated!' : 
        language === 'pl' ? 'Obraz wygenerowany!' : 
        'Зображення згенеровано!'
      );
      onImageUpdate?.();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error(error instanceof Error ? error.message : 'Error generating image');
    } finally {
      setIsGenerating(false);
    }
  };

  // Style selector component
  const StyleSelector = () => (
    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <Palette className="w-3 h-3 mr-1" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {IMAGE_STYLES.map(style => (
          <SelectItem key={style.value} value={style.value}>
            {getStyleLabel(style)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // No image - show generate button for admin
  if (!imageUrl) {
    if (!isAdmin) return null;
    
    return (
      <div className="relative border-2 border-dashed border-border rounded-lg p-8 mb-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
        <ImagePlus className="w-12 h-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {language === 'en' ? 'No image available' : 
           language === 'pl' ? 'Brak obrazu' : 
           'Зображення відсутнє'}
        </p>
        <div className="flex items-center gap-2">
          <StyleSelector />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {language === 'en' ? 'Generate' : 
             language === 'pl' ? 'Generuj' : 
             'Згенерувати'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      <img 
        src={imageUrl} 
        alt="" 
        className="w-full h-auto max-h-96 object-cover rounded-lg border border-border"
      />
      
      {/* Full retelling badge */}
      {hasRetelling && (
        <div className="absolute top-3 left-3">
          <Badge className="bg-primary/90 text-primary-foreground gap-1">
            <Sparkles className="w-3 h-3" />
            Full retelling
          </Badge>
        </div>
      )}
      
      {/* Admin regenerate controls */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <StyleSelector />
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {language === 'en' ? 'Regenerate' : 
             language === 'pl' ? 'Regeneruj' : 
             'Перегенерувати'}
          </Button>
        </div>
      )}
    </div>
  );
}
