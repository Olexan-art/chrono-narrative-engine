import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { adminAction } from '@/lib/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { uk } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload, X, ExternalLink, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface JustBusinessPanelProps {
  password: string;
}

export function JustBusinessPanel({ password }: JustBusinessPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    title_en: '',
    title_pl: '',
    content: '',
    content_en: '',
    content_pl: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch chapters for current month
  const { data: chapters } = useQuery({
    queryKey: ['just-business-chapters', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth() + 1;

      const { data: volumes } = await supabase
        .from('volumes')
        .select('id')
        .eq('year', year)
        .eq('month', month)
        .limit(1);

      if (!volumes?.length) return [];

      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, number, title, week_of_month')
        .eq('volume_id', volumes[0].id)
        .order('number');

      return chapters || [];
    }
  });

  // Fetch existing Just Business parts
  const { data: justBusinessParts, isLoading } = useQuery({
    queryKey: ['just-business-parts', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('parts')
        .select(`
          id, title, title_en, title_pl, content, date, status, 
          cover_image_url, manual_images, category, number,
          chapter:chapters(id, title, number, volume:volumes(id, title, number))
        `)
        .eq('category', 'just_business')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (uploadedImages.length + files.length > 4) {
      toast({
        title: 'Ліміт зображень',
        description: 'Максимум 4 зображення',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    const newImages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `just-business/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('manual-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('manual-images')
          .getPublicUrl(filePath);

        newImages.push(urlData.publicUrl);
      }

      setUploadedImages(prev => [...prev, ...newImages]);
      toast({
        title: 'Завантажено',
        description: `${newImages.length} зображень додано`
      });
    } catch (error) {
      toast({
        title: 'Помилка',
        description: 'Не вдалося завантажити зображення',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!chapters?.length) {
        throw new Error('Немає глав для цього місяця');
      }

      // Find the chapter for the week of the date
      const selectedDate = new Date(formData.date);
      const weekOfMonth = Math.ceil(selectedDate.getDate() / 7);
      const chapter = chapters.find(c => c.week_of_month === weekOfMonth) || chapters[0];

      // Get the next number for this date
      const { data: existingParts } = await supabase
        .from('parts')
        .select('number')
        .eq('date', formData.date)
        .order('number', { ascending: false })
        .limit(1);

      const nextNumber = (existingParts?.[0]?.number || 0) + 1;

      const result = await adminAction<{ part: { id: string } }>('createPart', password, {
        title: formData.title,
        title_en: formData.title_en || null,
        title_pl: formData.title_pl || null,
        content: formData.content,
        content_en: formData.content_en || null,
        content_pl: formData.content_pl || null,
        date: formData.date,
        number: nextNumber,
        chapter_id: chapter.id,
        status: 'draft',
        category: 'just_business',
        manual_images: uploadedImages,
        cover_image_url: uploadedImages[0] || null,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['just-business-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['latest-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      
      toast({
        title: 'Створено!',
        description: 'Just Business запис додано'
      });
      
      // Reset form
      setFormData({
        title: '',
        title_en: '',
        title_pl: '',
        content: '',
        content_en: '',
        content_pl: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
      setUploadedImages([]);
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося створити',
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminAction('deletePart', password, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['just-business-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({ title: 'Видалено!' });
    }
  });

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirm({ id, title });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-medium">
            {format(currentMonth, 'LLLL yyyy', { locale: uk })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Новий запис
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">Новий Just Business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Заголовок (UA)</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Заголовок українською"
                />
              </div>
              <div>
                <Label>Title (EN)</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  placeholder="English title"
                />
              </div>
              <div>
                <Label>Tytuł (PL)</Label>
                <Input
                  value={formData.title_pl}
                  onChange={(e) => setFormData({ ...formData, title_pl: e.target.value })}
                  placeholder="Polski tytuł"
                />
              </div>
            </div>

            <div>
              <Label>Контент (UA)</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Текст українською..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Content (EN)</Label>
                <Textarea
                  value={formData.content_en}
                  onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                  placeholder="English content..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Treść (PL)</Label>
                <Textarea
                  value={formData.content_pl}
                  onChange={(e) => setFormData({ ...formData, content_pl: e.target.value })}
                  placeholder="Polska treść..."
                  rows={3}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <Label>Зображення (до 4)</Label>
              <div className="mt-2 space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isUploading || uploadedImages.length >= 4}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading || uploadedImages.length >= 4}
                    onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'Завантаження...' : 'Завантажити'}
                  </Button>
                </div>

                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {uploadedImages.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 text-xs bg-primary text-primary-foreground px-1 rounded">
                            Обкладинка
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!formData.title || !formData.content || createMutation.isPending}
              >
                {createMutation.isPending ? 'Створення...' : 'Створити'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Скасувати
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Завантаження...</div>
      ) : !justBusinessParts?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          Немає записів Just Business за цей місяць
        </div>
      ) : (
        <div className="grid gap-4">
          {justBusinessParts.map((part: any) => {
            const manualImages = Array.isArray(part.manual_images) ? part.manual_images : [];
            
            return (
              <Card key={part.id} className="overflow-hidden">
                <div className="flex">
                  {/* Images preview */}
                  {manualImages.length > 0 && (
                    <div className="w-32 flex-shrink-0">
                      <img
                        src={manualImages[0]}
                        alt={part.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <CardContent className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded">
                            JUST BUSINESS
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(part.date), 'd MMMM yyyy', { locale: uk })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            part.status === 'published' 
                              ? 'bg-green-500/20 text-green-500' 
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {part.status === 'published' ? 'ОПУБЛІКОВАНО' : 'ЧЕРНЕТКА'}
                          </span>
                        </div>
                        <h4 className="font-medium">{part.title}</h4>
                        {part.title_en && (
                          <p className="text-sm text-muted-foreground">{part.title_en}</p>
                        )}
                        {manualImages.length > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            +{manualImages.length - 1} зображень
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/admin/part/${part.id}`}>
                            <Edit className="h-3 w-3 mr-1" />
                            Редагувати
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/read/${part.date}/${part.number}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Читати
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(part.id, part.title)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити запис?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити "{deleteConfirm?.title}"? Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}