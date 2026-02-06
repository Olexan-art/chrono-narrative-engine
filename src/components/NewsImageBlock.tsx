import { useState, useRef } from "react";
import { ImagePlus, RefreshCw, Loader2, Sparkles, Palette, Upload, Trash2, RotateCcw, Wand2 } from "lucide-react";
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
  entities?: Array<{ name: string; entity_type: string; description?: string }>;
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
  { value: 'pixel', label: 'Піксель-арт', labelEn: 'Pixel Art', labelPl: 'Pixel Art', prompt: 'pixel art style, retro 16-bit graphics, vibrant limited color palette, nostalgic gaming aesthetic' },
  { value: 'cyberpunk', label: 'Кіберпанк', labelEn: 'Cyberpunk', labelPl: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic dystopia, high-tech low-life, glowing elements, dark urban' },
  { value: 'watercolor', label: 'Акварель', labelEn: 'Watercolor', labelPl: 'Akwarela', prompt: 'watercolor painting style, soft flowing colors, artistic brush strokes, delicate washes, artistic impression' },
  { value: 'impressionism', label: 'Імпресіонізм', labelEn: 'Impressionism', labelPl: 'Impresjonizm', prompt: 'impressionist painting style, visible brush strokes, light and color emphasis, Monet-inspired, soft dreamy' },
  { value: 'surrealism', label: 'Сюрреалізм', labelEn: 'Surrealism', labelPl: 'Surrealizm', prompt: 'surrealist art style, dreamlike imagery, unexpected juxtapositions, Salvador Dali inspired, bizarre elements' },
  { value: 'vector', label: 'Vector art', labelEn: 'Vector Art', labelPl: 'Vector Art', prompt: 'clean vector art, flat design, minimal gradients, sharp edges, modern graphic design, geometric shapes' },
  { value: 'comic', label: 'Комікс', labelEn: 'Comic', labelPl: 'Komiks', prompt: 'comic book style, bold outlines, halftone dots, dynamic action panels, vibrant pop colors, superhero aesthetic' },
  { value: 'gothic', label: 'Готичний', labelEn: 'Gothic', labelPl: 'Gotycki', prompt: 'gothic art style, dark romantic atmosphere, ornate details, medieval influences, dramatic and moody' },
  { value: 'vintage', label: 'Вінтаж', labelEn: 'Vintage', labelPl: 'Vintage', prompt: 'vintage retro style, aged paper texture, faded colors, 1950s-1960s aesthetic, nostalgic warm tones' },
];

export function NewsImageBlock({
  imageUrl,
  newsId,
  title,
  keywords = [],
  themes = [],
  keyPoints = [],
  entities = [],
  hasRetelling,
  isAdmin,
  onImageUpdate
}: NewsImageBlockProps) {
  const { language } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('realistic');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Mentioned entities (people, companies, organizations)
    if (entities.length > 0) {
      const entityDescriptions = entities.slice(0, 5).map(e => {
        const type = e.entity_type === 'person' ? 'Person' : 
                     e.entity_type === 'company' ? 'Company' : 'Organization';
        return `${e.name} (${type})`;
      });
      parts.push(`Key figures: ${entityDescriptions.join(', ')}`);
    }

    // Get style prompt
    const styleConfig = IMAGE_STYLES.find(s => s.value === selectedStyle) || IMAGE_STYLES[0];

    return `Create a news article illustration based on: ${parts.join('. ')}. 
Style: ${styleConfig.prompt}. High quality, 16:9 aspect ratio.`;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `news/${newsId}/cover.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path);
      
      const { error: updateError } = await supabase
        .from('news_rss_items')
        .update({ image_url: urlData.publicUrl })
        .eq('id', newsId);
      
      if (updateError) throw updateError;

      toast.success(
        language === 'en' ? 'Image uploaded!' :
        language === 'pl' ? 'Obraz przesłany!' :
        'Зображення завантажено!'
      );
      onImageUpdate?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!imageUrl) return;
    
    setIsDeleting(true);
    try {
      // Remove from database
      const { error } = await supabase
        .from('news_rss_items')
        .update({ image_url: null })
        .eq('id', newsId);
      
      if (error) throw error;

      toast.success(
        language === 'en' ? 'Image deleted!' :
        language === 'pl' ? 'Obraz usunięty!' :
        'Зображення видалено!'
      );
      onImageUpdate?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
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

  const handleEnhance = async () => {
    if (!imageUrl) return;
    
    setIsEnhancing(true);
    try {
      console.log('Enhancing image:', imageUrl);
      
      const result = await callEdgeFunction<{
        success: boolean;
        imageUrl: string;
        error?: string;
      }>('generate-image', {
        action: 'enhance',
        imageUrl,
        newsId
      });
      
      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Failed to enhance image');
      }
      
      // Update news item with enhanced image
      const { error } = await supabase
        .from('news_rss_items')
        .update({ image_url: result.imageUrl })
        .eq('id', newsId);
      
      if (error) throw error;
      
      toast.success(
        language === 'en' ? 'Image enhanced!' : 
        language === 'pl' ? 'Obraz ulepszony!' : 
        'Зображення покращено!'
      );
      onImageUpdate?.();
    } catch (error) {
      console.error('Error enhancing image:', error);
      toast.error(error instanceof Error ? error.message : 'Error enhancing image');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Hidden file input
  const FileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleUpload}
    />
  );

  // Style selector component
  const StyleSelector = () => (
    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <Palette className="w-3 h-3 mr-1" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {IMAGE_STYLES.map(style => (
          <SelectItem key={style.value} value={style.value}>
            {getStyleLabel(style)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // No image - show generate/upload buttons for admin
  if (!imageUrl) {
    if (!isAdmin) return null;
    
    return (
      <div className="relative border-2 border-dashed border-border rounded-lg p-8 mb-4 flex flex-col items-center justify-center gap-3 bg-muted/20">
        <FileInput />
        <ImagePlus className="w-12 h-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {language === 'en' ? 'No image available' : 
           language === 'pl' ? 'Brak obrazu' : 
           'Зображення відсутнє'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <StyleSelector />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleGenerate}
            disabled={isGenerating || isUploading}
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
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {language === 'en' ? 'Upload' : 
             language === 'pl' ? 'Prześlij' : 
             'Завантажити'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      <FileInput />
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
      
      {/* Admin controls */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2">
          <StyleSelector />
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 shadow-lg"
            onClick={onImageUpdate}
            title={language === 'en' ? 'Refresh' : language === 'pl' ? 'Odśwież' : 'Оновити'}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={handleEnhance}
            disabled={isGenerating || isUploading || isDeleting || isEnhancing}
            title={language === 'en' ? 'Enhance with AI' : language === 'pl' ? 'Ulepsz z AI' : 'Покращити з ШІ'}
          >
            {isEnhancing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {language === 'en' ? 'Enhance' : 
             language === 'pl' ? 'Ulepsz' : 
             'Покращити'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={handleGenerate}
            disabled={isGenerating || isUploading || isDeleting || isEnhancing}
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
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || isUploading || isDeleting || isEnhancing}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {language === 'en' ? 'Upload' : 
             language === 'pl' ? 'Prześlij' : 
             'Завантажити'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 shadow-lg"
            onClick={handleDelete}
            disabled={isGenerating || isUploading || isDeleting || isEnhancing}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {language === 'en' ? 'Delete' : 
             language === 'pl' ? 'Usuń' : 
             'Видалити'}
          </Button>
        </div>
      )}
    </div>
  );
}
