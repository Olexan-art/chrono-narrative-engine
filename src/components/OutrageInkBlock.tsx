import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Upload, Trash2, Wand2, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const t = {
    title: language === 'en' ? 'Outrage Ink' : language === 'pl' ? 'Outrage Ink' : 'Outrage Ink',
    upload: language === 'en' ? 'Upload' : language === 'pl' ? 'Prześlij' : 'Завантажити',
    generate: language === 'en' ? 'Generate Satire' : language === 'pl' ? 'Generuj satyrę' : 'Генерувати сатиру',
    delete: language === 'en' ? 'Delete' : language === 'pl' ? 'Usuń' : 'Видалити',
    confirmDelete: language === 'en' ? 'Delete this caricature?' : language === 'pl' ? 'Usunąć tę karykaturę?' : 'Видалити цю карикатуру?',
    noImage: language === 'en' ? 'No satirical image yet' : language === 'pl' ? 'Brak satyry' : 'Сатиричного зображення ще немає',
    generating: language === 'en' ? 'Generating...' : language === 'pl' ? 'Generowanie...' : 'Генерація...',
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
        // Call edge function to generate satire image
        const result = await callEdgeFunction<{ success: boolean; imageUrl?: string; error?: string }>(
          'generate-image',
          {
            prompt: `Create a satirical political caricature/cartoon about this news without any text or labels: "${newsTitle}". Style: sharp editorial cartoon, exaggerated features, stark contrast, minimalist background.`,
            type: 'satire'
          }
        );

        if (!result.success || !result.imageUrl) {
          throw new Error(result.error || 'Failed to generate image');
        }

        // Save to outrage_ink
        if (ink) {
          await supabase
            .from('outrage_ink')
            .update({ image_url: result.imageUrl, title: newsTitle })
            .eq('id', ink.id);
        } else {
          const { data: newInk } = await supabase
            .from('outrage_ink')
            .insert({ 
              news_item_id: newsItemId, 
              image_url: result.imageUrl, 
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

        return result.imageUrl;
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Caricature generated!' : 'Карикатуру згенеровано!');
      queryClient.invalidateQueries({ queryKey: ['outrage-ink', newsItemId] });
    },
    onError: (e) => {
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
              className="w-full rounded-lg"
              loading="lazy"
            />
            
            {/* Like/Dislike overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 ${userVote === 'like' ? 'text-green-500' : ''}`}
                onClick={() => voteMutation.mutate('like')}
                disabled={voteMutation.isPending}
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm">{ink.likes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1 ${userVote === 'dislike' ? 'text-red-500' : ''}`}
                onClick={() => voteMutation.mutate('dislike')}
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
        )}
      </CardContent>
    </Card>
  );
}