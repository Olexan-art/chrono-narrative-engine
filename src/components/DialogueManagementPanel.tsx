import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageSquare, RefreshCw, Loader2, Calendar, Check, X, Users, UserPlus } from "lucide-react";
import { generateDialogue } from "@/lib/api";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { LLM_MODELS, type LLMProvider } from "@/types/database";

interface Character {
  id: string;
  character_id: string;
  name: string;
  avatar: string;
  style: string;
  is_active: boolean;
}

interface DialogueManagementPanelProps {
  password: string;
}

interface DialogueMessage {
  character?: string;
  name?: string;
  avatar?: string;
  message?: string;
  likes?: number;
}

interface Part {
  id: string;
  title: string;
  content: string;
  date: string;
  status: string;
  chat_dialogue: DialogueMessage[] | unknown;
  chat_dialogue_en: DialogueMessage[] | unknown;
  chat_dialogue_pl: DialogueMessage[] | unknown;
  chapter: {
    id: string;
    title: string;
  };
}

export default function DialogueManagementPanel({ password }: DialogueManagementPanelProps) {
  const queryClient = useQueryClient();
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(8);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>("lovable");
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-flash-preview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);

  // Get text models for provider
  const getTextModels = (provider: LLMProvider) => {
    return LLM_MODELS[provider]?.text || [];
  };

  // Fetch all active characters
  const { data: characters } = useQuery({
    queryKey: ["dialogue-characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, character_id, name, avatar, style, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Character[];
    },
  });

  // Fetch parts with dialogues
  const { data: parts, isLoading: partsLoading } = useQuery({
    queryKey: ["dialogue-parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("id, title, content, date, status, chat_dialogue, chat_dialogue_en, chat_dialogue_pl, chapter:chapters(id, title)")
        .eq("status", "published")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Part[];
    },
  });

  // Toggle character selection
  const toggleCharacter = (characterId: string) => {
    setSelectedCharacters(prev => 
      prev.includes(characterId) 
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  // Select all characters
  const selectAllCharacters = () => {
    if (characters) {
      setSelectedCharacters(characters.map(c => c.character_id));
    }
  };

  // Clear character selection
  const clearCharacterSelection = () => {
    setSelectedCharacters([]);
  };

  // Regenerate dialogue mutation
  const regenerateMutation = useMutation({
    mutationFn: async (partId: string) => {
      setIsGenerating(true);
      const part = parts?.find((p) => p.id === partId);
      if (!part) throw new Error("Part not found");

      // Get selected character details for prompt
      const selectedCharacterDetails = characters?.filter(c => 
        selectedCharacters.includes(c.character_id)
      ) || [];

      // Get news context
      const { data: newsItems } = await supabase
        .from("news_items")
        .select("title, description, source_name")
        .eq("used_for_part_id", partId)
        .limit(5);

      const newsContext = newsItems?.map((n) => `${n.title} - ${n.source_name}`).join("\n") || "Світові події";

      // Build character context for the prompt
      const characterContext = selectedCharacterDetails.length > 0
        ? selectedCharacterDetails.map(c => `${c.name} (${c.avatar}) - стиль: ${c.style}`).join(", ")
        : undefined;

      const result = await generateDialogue({
        storyContext: part.content.substring(0, 1500),
        newsContext,
        useOpenAI: selectedProvider === "openai",
        messageCount,
        characters: characterContext,
      });

      if (!result.success) throw new Error("Failed to generate dialogue");

      // Update part with new dialogue
      const { error } = await supabase
        .from("parts")
        .update({
          chat_dialogue: result.dialogue,
          chat_dialogue_en: result.dialogue_en,
          chat_dialogue_pl: result.dialogue_pl,
        })
        .eq("id", partId);

      if (error) throw error;

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dialogue-parts"] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Діалог перегенеровано успішно");
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const selectedPart = parts?.find((p) => p.id === selectedPartId);
  const dialogueCount = (arr: unknown) => Array.isArray(arr) ? arr.length : 0;
  
  // Get unique character count from dialogue
  const getCharacterCount = (dialogue: unknown) => {
    if (!Array.isArray(dialogue)) return 0;
    const uniqueCharacters = new Set(
      dialogue.map((msg: DialogueMessage) => msg.character || msg.name).filter(Boolean)
    );
    return uniqueCharacters.size;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Керування діалогами
        </h3>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Налаштування генерації</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Провайдер LLM</Label>
              <Select value={selectedProvider} onValueChange={(v) => {
                setSelectedProvider(v as LLMProvider);
                const models = getTextModels(v as LLMProvider);
                if (models.length) setSelectedModel(models[0].value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Модель</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTextModels(selectedProvider).map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Кількість повідомлень</Label>
              <Input
                type="number"
                min={4}
                max={20}
                value={messageCount}
                onChange={(e) => setMessageCount(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Character Selection */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Учасники діалогу ({selectedCharacters.length} обрано)
              </Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllCharacters}>
                  Всіх
                </Button>
                <Button variant="outline" size="sm" onClick={clearCharacterSelection}>
                  Очистити
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {characters?.map((char) => (
                <div
                  key={char.id}
                  onClick={() => toggleCharacter(char.character_id)}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedCharacters.includes(char.character_id)
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedCharacters.includes(char.character_id)}
                    onCheckedChange={() => toggleCharacter(char.character_id)}
                  />
                  <span className="text-lg">{char.avatar}</span>
                  <span className="text-sm truncate">{char.name}</span>
                </div>
              ))}
            </div>
            {selectedCharacters.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Якщо персонажі не обрані — ШІ сам визначить учасників на основі контексту історії
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Оповіді з діалогами</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {partsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="divide-y">
                  {parts?.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => setSelectedPartId(part.id)}
                      className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedPartId === part.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{part.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(part.date), "d MMM yyyy", { locale: uk })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {getCharacterCount(part.chat_dialogue) > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {getCharacterCount(part.chat_dialogue)}
                            </Badge>
                          )}
                          {dialogueCount(part.chat_dialogue) > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              {dialogueCount(part.chat_dialogue)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <X className="h-3 w-3 mr-1" />
                              Немає
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected Part Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedPart ? selectedPart.title : "Виберіть оповідь"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPart ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 p-2 rounded">
                    <p className="text-lg font-bold">{dialogueCount(selectedPart.chat_dialogue)}</p>
                    <p className="text-xs text-muted-foreground">🇺🇦 UA</p>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <p className="text-lg font-bold">{dialogueCount(selectedPart.chat_dialogue_en)}</p>
                    <p className="text-xs text-muted-foreground">🇬🇧 EN</p>
                  </div>
                  <div className="bg-muted/50 p-2 rounded">
                    <p className="text-lg font-bold">{dialogueCount(selectedPart.chat_dialogue_pl)}</p>
                    <p className="text-xs text-muted-foreground">🇵🇱 PL</p>
                  </div>
                </div>

                {Array.isArray(selectedPart.chat_dialogue) && selectedPart.chat_dialogue.length > 0 && (
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {(selectedPart.chat_dialogue as Array<{ name: string; avatar: string; message: string }>).map((msg, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-lg">{msg.avatar}</span>
                          <div>
                            <span className="font-medium">{msg.name}:</span>
                            <span className="text-muted-foreground ml-1">{msg.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <Button
                  onClick={() => regenerateMutation.mutate(selectedPart.id)}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Генерація...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Перегенерувати діалог
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Виберіть оповідь зі списку для перегляду та перегенерації діалогу
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
