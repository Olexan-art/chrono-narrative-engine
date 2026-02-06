import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Upload, Trash2, Wand2, Loader2, ThumbsUp, ThumbsDown, Download, Share2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { callEdgeFunction } from "@/lib/api";

interface OutrageInkBlockProps {
  newsItemId: string;
  newsTitle: string;
  wikiEntityIds?: string[];
  isAdmin: boolean;
}

interface OutrageInk {
  id: string;
  image_url: string;
  title: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
}

export function OutrageInkBlock({ 
  newsItemId, 
  newsTitle,
  wikiEntityIds = [],
  isAdmin 
}: OutrageInkBlockProps) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('standard');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Unified style options matching NewsImageBlock + additional Outrage Ink styles
  const styleOptions = [
    // Original styles
    { value: 'standard', label: language === 'en' ? 'Standard' : language === 'pl' ? 'Standardowy' : 'Стандарт', prompt: 'sharp editorial cartoon, exaggerated features, stark contrast, minimalist background' },
    { value: 'anime90s', label: language === 'en' ? '90s Anime' : language === 'pl' ? 'Anime lat 90' : 'Аніме 90-х', prompt: '90s anime aesthetic with cel-shading, dramatic speed lines, exaggerated expressions, vibrant colors, retro anime character designs like Akira or Ghost in the Shell' },
    { value: 'horror', label: language === 'en' ? 'Horror' : language === 'pl' ? 'Horror' : 'Жахи', prompt: 'dark horror aesthetic, grotesque exaggerated features, eerie shadows, unsettling atmosphere, macabre imagery, twisted and distorted forms like Junji Ito manga' },
    { value: 'action90s', label: language === 'en' ? '90s Action' : language === 'pl' ? 'Akcja lat 90' : 'Бойовики 90-х', prompt: '90s action movie poster aesthetic, explosive dynamic poses, dramatic lighting, muscular exaggerated characters, bold colors, lens flares, cinematic composition' },
    { value: 'disco80s', label: language === 'en' ? '80s Disco' : language === 'pl' ? 'Disco lat 80' : 'Діско 80-х', prompt: '80s disco aesthetic, neon colors, chrome and grid patterns, synth-wave vibes, glittery glamorous characters, retro-futuristic elements, vibrant pink and cyan color palette' },
    // Additional styles from NewsImageBlock
    { value: 'realistic', label: language === 'en' ? 'Realistic' : language === 'pl' ? 'Realistyczny' : 'Реалістичний', prompt: 'photorealistic, editorial photography, professional journalism style' },
    { value: 'illustration', label: language === 'en' ? 'Illustration' : language === 'pl' ? 'Ilustracja' : 'Ілюстрація', prompt: 'digital illustration, editorial art, clean vector-like style, modern design' },
    { value: 'caricature', label: language === 'en' ? 'Caricature' : language === 'pl' ? 'Karykatura' : 'Карикатура', prompt: 'satirical caricature, exaggerated features, political cartoon style, expressive' },
    { value: 'noir', label: language === 'en' ? 'Noir' : language === 'pl' ? 'Noir' : 'Нуар', prompt: 'film noir style, dramatic shadows, black and white with high contrast, mysterious atmosphere' },
    { value: 'pixel', label: language === 'en' ? 'Pixel Art' : language === 'pl' ? 'Pixel Art' : 'Піксель-арт', prompt: 'pixel art style, retro 16-bit graphics, vibrant limited color palette, nostalgic gaming aesthetic' },
    { value: 'cyberpunk', label: language === 'en' ? 'Cyberpunk' : language === 'pl' ? 'Cyberpunk' : 'Кіберпанк', prompt: 'cyberpunk style, neon lights, futuristic dystopia, high-tech low-life, glowing elements, dark urban' },
    { value: 'watercolor', label: language === 'en' ? 'Watercolor' : language === 'pl' ? 'Akwarela' : 'Акварель', prompt: 'watercolor painting style, soft flowing colors, artistic brush strokes, delicate washes, artistic impression' },
    { value: 'impressionism', label: language === 'en' ? 'Impressionism' : language === 'pl' ? 'Impresjonizm' : 'Імпресіонізм', prompt: 'impressionist painting style, visible brush strokes, light and color emphasis, Monet-inspired, soft dreamy' },
    { value: 'surrealism', label: language === 'en' ? 'Surrealism' : language === 'pl' ? 'Surrealizm' : 'Сюрреалізм', prompt: 'surrealist art style, dreamlike imagery, unexpected juxtapositions, Salvador Dali inspired, bizarre elements' },
    { value: 'vector', label: language === 'en' ? 'Vector Art' : language === 'pl' ? 'Vector Art' : 'Vector art', prompt: 'clean vector art, flat design, minimal gradients, sharp edges, modern graphic design, geometric shapes' },
    { value: 'comic', label: language === 'en' ? 'Comic' : language === 'pl' ? 'Komiks' : 'Комікс', prompt: 'comic book style, bold outlines, halftone dots, dynamic action panels, vibrant pop colors, superhero aesthetic' },
    { value: 'gothic', label: language === 'en' ? 'Gothic' : language === 'pl' ? 'Gotycki' : 'Готичний', prompt: 'gothic art style, dark romantic atmosphere, ornate details, medieval influences, dramatic and moody' },
    { value: 'vintage', label: language === 'en' ? 'Vintage' : language === 'pl' ? 'Vintage' : 'Вінтаж', prompt: 'vintage retro style, aged paper texture, faded colors, 1950s-1960s aesthetic, nostalgic warm tones' },
    { value: 'charcoal', label: language === 'en' ? 'Black & White' : language === 'pl' ? 'Czarno-biały' : 'Чорно-білий', prompt: 'black and white charcoal drawing, hand-drawn with charcoal on textured paper, expressive strokes, dramatic shading, artistic sketch, monochrome, raw and emotional, fine art style' },
  ];

  const getStylePrompt = (style: string, title: string): string => {
    const basePrompt = `Create a satirical political caricature/cartoon about this news without any text or labels: "${title}".`;
    const styleConfig = styleOptions.find(s => s.value === style);
    const stylePrompt = styleConfig?.prompt || 'sharp editorial cartoon, exaggerated features, stark contrast, minimalist background';
    return `${basePrompt} Style: ${stylePrompt}`;
  };

  const t = {
    title: language === 'en' ? 'Outrage Ink' : language === 'pl' ? 'Outrage Ink' : 'Outrage Ink',
    upload: language === 'en' ? 'Upload' : language === 'pl' ? 'Prześlij' : 'Завантажити',
    generate: language === 'en' ? 'Generate Satire' : language === 'pl' ? 'Generuj satyrę' : 'Генерувати сатиру',
    delete: language === 'en' ? 'Delete' : language === 'pl' ? 'Usuń' : 'Видалити',
    confirmDelete: language === 'en' ? 'Delete this caricature?' : language === 'pl' ? 'Usunąć tę karykaturę?' : 'Видалити цю карикатуру?',
    noImage: language === 'en' ? 'No satirical image yet' : language === 'pl' ? 'Brak satyry' : 'Сатиричного зображення ще немає',
    generating: language === 'en' ? 'Generating...' : language === 'pl' ? 'Generowanie...' : 'Генерація...',
    download: language === 'en' ? 'Download' : language === 'pl' ? 'Pobierz' : 'Завантажити',
    share: language === 'en' ? 'Share' : language === 'pl' ? 'Udostępnij' : 'Поширити',
  };

  // Handle image download
  const handleDownload = async () => {
    if (!ink?.image_url) return;
    try {
      const response = await fetch(ink.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `outrage-ink-${ink.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(language === 'en' ? 'Download failed' : 'Помилка завантаження');
    }
  };

  // Handle share to X
  const handleShareToX = () => {
    if (!ink?.image_url) return;
    const shareText = language === 'en' 
      ? `Check out this satirical caricature: ${newsTitle}`
      : language === 'pl'
      ? `Zobacz tę satyryczną karykaturę: ${newsTitle}`
      : `Дивіться цю сатиричну карикатуру: ${newsTitle}`;
    
    const currentUrl = window.location.href;
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(currentUrl)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
  };

  // Get visitor ID for voting
  const getVisitorId = (): string => {
    let id = localStorage.getItem('visitor_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('visitor_id', id);
    }
    return id;
  };

  // Fetch existing outrage ink for this news
  const { data: ink, isLoading } = useQuery({
    queryKey: ['outrage-ink', newsItemId],
    queryFn: async () => {
      const { data } = await supabase
        .from('outrage_ink')
        .select('*')
        .eq('news_item_id', newsItemId)
        .maybeSingle();
      return data as OutrageInk | null;
    },
  });

  // Check if user already voted
  const { data: userVote } = useQuery({
    queryKey: ['outrage-ink-vote', ink?.id, getVisitorId()],
    queryFn: async () => {
      if (!ink) return null;
      const { data } = await supabase
        .from('outrage_ink_votes')
        .select('vote_type')
        .eq('outrage_ink_id', ink.id)
        .eq('visitor_id', getVisitorId())
        .maybeSingle();
      return data?.vote_type as 'like' | 'dislike' | null;
    },
    enabled: !!ink,
  });

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      try {
        const ext = file.name.split('.').pop();
        const fileName = `${newsItemId}-${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('outrage-ink')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('outrage-ink')
          .getPublicUrl(fileName);

        // Create or update outrage_ink record
        if (ink) {
          await supabase
            .from('outrage_ink')
            .update({ image_url: publicUrl, title: newsTitle })
            .eq('id', ink.id);
        } else {
          const { data: newInk } = await supabase
            .from('outrage_ink')
            .insert({ 
              news_item_id: newsItemId, 
              image_url: publicUrl, 
              title: newsTitle 
            })
            .select()
            .single();

          // Link to wiki entities
          if (wikiEntityIds.length > 0 && newInk) {
            await supabase.from('outrage_ink_entities').insert(
              wikiEntityIds.map(entityId => ({
                outrage_ink_id: newInk.id,
                wiki_entity_id: entityId
              }))
            );
          }
        }

        return publicUrl;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Image uploaded!' : 'Зображення завантажено!');
      queryClient.invalidateQueries({ queryKey: ['outrage-ink', newsItemId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  });

  // Generate satirical image mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      try {
        const prompt = getStylePrompt(selectedStyle, newsTitle);
        
        // Call edge function to generate satire image
        const result = await callEdgeFunction<{ success: boolean; imageUrl?: string; error?: string }>(
          'generate-image',
          {
            prompt,
            type: 'satire'
          }
        );

        if (!result.success || !result.imageUrl) {
          throw new Error(result.error || 'Failed to generate image');
        }

        const imageUrl = result.imageUrl;

        // Save to outrage_ink with style-adjusted prompt
        if (ink) {
          const { error: updateError } = await supabase
            .from('outrage_ink')
            .update({ image_url: imageUrl, title: newsTitle, image_prompt: prompt })
            .eq('id', ink.id);
          
          if (updateError) throw updateError;
        } else {
          const { data: newInk, error: insertError } = await supabase
            .from('outrage_ink')
            .insert({ 
              news_item_id: newsItemId, 
              image_url: imageUrl, 
              title: newsTitle,
              image_prompt: prompt
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Link to wiki entities
          if (wikiEntityIds.length > 0 && newInk) {
            const { error: linkError } = await supabase.from('outrage_ink_entities').insert(
              wikiEntityIds.map(entityId => ({
                outrage_ink_id: newInk.id,
                wiki_entity_id: entityId
              }))
            );
            if (linkError) console.error('Failed to link entities:', linkError);
          }
        }

        return imageUrl;
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Caricature generated!' : 'Карикатуру згенеровано!');
      queryClient.invalidateQueries({ queryKey: ['outrage-ink', newsItemId] });
    },
    onError: (e) => {
      console.error('Generate mutation error:', e);
      toast.error(e instanceof Error ? e.message : 'Generation failed');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!ink) return;
      await supabase.from('outrage_ink').delete().eq('id', ink.id);
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Deleted' : 'Видалено');
      queryClient.invalidateQueries({ queryKey: ['outrage-ink', newsItemId] });
    }
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (voteType: 'like' | 'dislike') => {
      if (!ink) return;
      
      const visitorId = getVisitorId();

      // Insert vote
      await supabase.from('outrage_ink_votes').upsert({
        outrage_ink_id: ink.id,
        visitor_id: visitorId,
        vote_type: voteType
      }, { onConflict: 'outrage_ink_id,visitor_id' });

      // Update counts (simple increment)
      const updates = voteType === 'like' 
        ? { likes: ink.likes + 1 }
        : { dislikes: ink.dislikes + 1 };

      await supabase.from('outrage_ink').update(updates).eq('id', ink.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outrage-ink', newsItemId] });
      queryClient.invalidateQueries({ queryKey: ['outrage-ink-vote', ink?.id] });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDelete = () => {
    if (confirm(t.confirmDelete)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-rose-500/5 to-orange-500/5 border-rose-500/20">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        </CardContent>
      </Card>
    );
  }

  // Hide block for non-admins if there's no image
  if (!isAdmin && !ink?.image_url) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-rose-500/5 to-orange-500/5 border-rose-500/20 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="w-4 h-4 text-rose-500" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ink?.image_url ? (
          <div className="relative group">
            <img 
              src={ink.image_url} 
              alt={newsTitle}
              title={newsTitle}
              className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              onClick={() => setIsLightboxOpen(true)}
            />
            
            {/* Action buttons overlay */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                title={t.download}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={(e) => { e.stopPropagation(); handleShareToX(); }}
                title={t.share}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Like/Dislike overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 ${userVote === 'like' ? 'text-green-500' : ''}`}
                onClick={(e) => { e.stopPropagation(); voteMutation.mutate('like'); }}
                disabled={voteMutation.isPending}
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm">{ink.likes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 ${userVote === 'dislike' ? 'text-red-500' : ''}`}
                onClick={(e) => { e.stopPropagation(); voteMutation.mutate('dislike'); }}
                disabled={voteMutation.isPending}
              >
                <ThumbsDown className="w-4 h-4" />
                <span className="text-sm">{ink.dislikes}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
            <p className="text-sm text-muted-foreground">{t.noImage}</p>
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="space-y-3">
            {/* Style selector */}
            <div className="flex items-center gap-2">
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-1"
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {t.upload}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={isGenerating}
                className="gap-1"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {isGenerating ? t.generating : t.generate}
              </Button>
              {ink && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {t.delete}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Lightbox Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-background/95 backdrop-blur-sm border-none">
          <div className="relative flex items-center justify-center p-4">
            {ink?.image_url && (
              <img 
                src={ink.image_url} 
                alt={newsTitle}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
            {/* Lightbox action buttons */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-background/90 backdrop-blur-sm"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" />
                {t.download}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-background/90 backdrop-blur-sm"
                onClick={handleShareToX}
              >
                <X className="w-4 h-4" />
                {t.share}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}