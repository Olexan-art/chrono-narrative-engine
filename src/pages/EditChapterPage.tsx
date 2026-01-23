import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, RefreshCw, Image, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAdminStore } from "@/stores/adminStore";
import { adminAction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Chapter, ChatMessage, Tweet } from "@/types/database";

export default function EditChapterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, password } = useAdminStore();
  
  const [formData, setFormData] = useState<Partial<Chapter>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*, volume:volumes(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Chapter & { volume?: any };
    },
    enabled: isAuthenticated && !!id
  });

  useEffect(() => {
    if (chapter) {
      setFormData(chapter);
      setChatMessages(Array.isArray(chapter.chat_dialogue) ? chapter.chat_dialogue as ChatMessage[] : []);
      setTweets(Array.isArray(chapter.tweets) ? chapter.tweets as Tweet[] : []);
    }
  }, [chapter]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Chapter>) => {
      const updateData = {
        ...data,
        id,
        chat_dialogue: chatMessages,
        tweets: tweets
      };
      await adminAction('updateChapter', password, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapter-edit', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-chapters'] });
      toast({ title: "Главу збережено" });
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося зберегти",
        variant: "destructive"
      });
    }
  });

  const handleGenerateImage = async (index: 1 | 2 | 3) => {
    const promptKey = index === 1 ? 'cover_image_prompt' : index === 2 ? 'cover_image_prompt_2' : 'cover_image_prompt_3';
    const prompt = formData[promptKey];
    
    if (!prompt) {
      toast({ title: "Введіть промт для зображення", variant: "destructive" });
      return;
    }
    
    setGeneratingImage(index);
    try {
      const { error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, chapterId: id, imageIndex: index }
      });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['chapter-edit', id] });
      toast({ title: `Зображення ${index} згенеровано!` });
    } catch (error) {
      toast({
        title: "Помилка генерації",
        description: error instanceof Error ? error.message : "Невідома помилка",
        variant: "destructive"
      });
    } finally {
      setGeneratingImage(null);
    }
  };

  const addChatMessage = () => {
    setChatMessages([
      ...chatMessages,
      { character: 'stranger', name: 'Незнайомець', avatar: '🌑', message: '' }
    ]);
  };

  const updateChatMessage = (index: number, field: keyof ChatMessage, value: string) => {
    const updated = [...chatMessages];
    updated[index] = { ...updated[index], [field]: value };
    setChatMessages(updated);
  };

  const removeChatMessage = (index: number) => {
    setChatMessages(chatMessages.filter((_, i) => i !== index));
  };

  const addTweet = () => {
    setTweets([
      ...tweets,
      { author: 'The Stranger 🌑', handle: '@unknown_witness', content: '', likes: 1000, retweets: 200 }
    ]);
  };

  const updateTweet = (index: number, field: keyof Tweet, value: string | number) => {
    const updated = [...tweets];
    updated[index] = { ...updated[index], [field]: value };
    setTweets(updated);
  };

  const removeTweet = (index: number) => {
    setTweets(tweets.filter((_, i) => i !== index));
  };

  if (!isAuthenticated) {
    navigate('/admin');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Главу не знайдено</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Редагування глави</h1>
              <p className="text-sm text-muted-foreground font-mono">
                Тиждень {chapter.week_of_month} • {chapter.volume?.title}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/chapter/${id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="w-3 h-3" />
                Переглянути
              </Button>
            </Link>
            <Button
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зберегти
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Назва глави</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Опис</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Narrative Content */}
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Наративний контент</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Монолог Незнайомця</Label>
                <Textarea
                  value={formData.narrator_monologue || ''}
                  onChange={(e) => setFormData({ ...formData, narrator_monologue: e.target.value })}
                  rows={6}
                  placeholder="Таємничий монолог від першої особи..."
                />
              </div>
              <div className="space-y-2">
                <Label>Коментар Наратора</Label>
                <Textarea
                  value={formData.narrator_commentary || ''}
                  onChange={(e) => setFormData({ ...formData, narrator_commentary: e.target.value })}
                  rows={6}
                  placeholder="Філософський коментар від ШІ-архіватора..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Cover Images */}
          <Card className="cosmic-card">
            <CardHeader>
              <CardTitle>Обкладинки</CardTitle>
              <CardDescription>Три зображення для глави</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3].map((index) => {
                const promptKey = index === 1 ? 'cover_image_prompt' : index === 2 ? 'cover_image_prompt_2' : 'cover_image_prompt_3';
                const urlKey = index === 1 ? 'cover_image_url' : index === 2 ? 'cover_image_url_2' : 'cover_image_url_3';
                
                return (
                  <div key={index} className="flex gap-4">
                    {formData[urlKey] && (
                      <img
                        src={formData[urlKey] as string}
                        alt=""
                        className="w-24 h-24 object-cover border border-border shrink-0"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <Label>Промт зображення {index}</Label>
                      <div className="flex gap-2">
                        <Textarea
                          value={(formData[promptKey] as string) || ''}
                          onChange={(e) => setFormData({ ...formData, [promptKey]: e.target.value })}
                          rows={2}
                          placeholder={`Prompt for cover image ${index}...`}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleGenerateImage(index as 1 | 2 | 3)}
                          disabled={generatingImage === index}
                        >
                          {generatingImage === index ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Image className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Chat Dialogue */}
          <Card className="cosmic-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Чат персонажів</CardTitle>
                  <CardDescription>Діалог між персонажами наприкінці глави</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addChatMessage} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Додати
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {chatMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Немає повідомлень чату</p>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className="flex gap-4 p-4 border border-border rounded-lg">
                    <div className="space-y-2 shrink-0">
                      <Input
                        value={msg.avatar}
                        onChange={(e) => updateChatMessage(index, 'avatar', e.target.value)}
                        className="w-16 text-center text-2xl"
                        placeholder="🌑"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={msg.name}
                          onChange={(e) => updateChatMessage(index, 'name', e.target.value)}
                          placeholder="Ім'я персонажа"
                          className="flex-1"
                        />
                        <Input
                          value={msg.character}
                          onChange={(e) => updateChatMessage(index, 'character', e.target.value)}
                          placeholder="character_id"
                          className="w-32 font-mono text-xs"
                        />
                      </div>
                      <Textarea
                        value={msg.message}
                        onChange={(e) => updateChatMessage(index, 'message', e.target.value)}
                        placeholder="Текст повідомлення..."
                        rows={2}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChatMessage(index)}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Tweets */}
          <Card className="cosmic-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Твіти</CardTitle>
                  <CardDescription>Іронічні твіти від персонажів наративу</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addTweet} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Додати
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tweets.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Немає твітів</p>
              ) : (
                tweets.map((tweet, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={tweet.author}
                        onChange={(e) => updateTweet(index, 'author', e.target.value)}
                        placeholder="The Stranger 🌑"
                        className="flex-1"
                      />
                      <Input
                        value={tweet.handle}
                        onChange={(e) => updateTweet(index, 'handle', e.target.value)}
                        placeholder="@handle"
                        className="w-40 font-mono text-xs"
                      />
                    </div>
                    <Textarea
                      value={tweet.content}
                      onChange={(e) => updateTweet(index, 'content', e.target.value)}
                      placeholder="Текст твіту..."
                      rows={2}
                    />
                    <div className="flex gap-4 items-center">
                      <div className="flex gap-2 items-center flex-1">
                        <Label className="text-xs">❤️</Label>
                        <Input
                          type="number"
                          value={tweet.likes}
                          onChange={(e) => updateTweet(index, 'likes', parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                        <Label className="text-xs">🔁</Label>
                        <Input
                          type="number"
                          value={tweet.retweets}
                          onChange={(e) => updateTweet(index, 'retweets', parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTweet(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
