import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, User } from "lucide-react";
import { adminAction } from "@/lib/api";

interface Character {
  id: string;
  character_id: string;
  name: string;
  avatar: string;
  style: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CharactersPanelProps {
  password: string;
}

export default function CharactersPanel({ password }: CharactersPanelProps) {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    character_id: "",
    name: "",
    avatar: "🎭",
    style: "",
    description: "",
    is_active: true,
  });

  const { data: characters, isLoading } = useQuery({
    queryKey: ["characters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Character[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return adminAction("createCharacter", password, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Персонажа створено");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Character>) => {
      return adminAction("updateCharacter", password, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Персонажа оновлено");
      setEditingCharacter(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminAction("deleteCharacter", password, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success("Персонажа видалено");
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      character_id: "",
      name: "",
      avatar: "🎭",
      style: "",
      description: "",
      is_active: true,
    });
  };

  const openEditDialog = (character: Character) => {
    setEditingCharacter(character);
    setFormData({
      character_id: character.character_id,
      name: character.name,
      avatar: character.avatar,
      style: character.style,
      description: character.description || "",
      is_active: character.is_active,
    });
  };

  const handleSubmit = () => {
    if (!formData.character_id || !formData.name || !formData.style) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    if (editingCharacter) {
      updateMutation.mutate({ ...formData, id: editingCharacter.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Видалити персонажа "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Common emoji options for avatar
  const emojiOptions = ["🎭", "🖤", "⚔️", "🔴", "🐺", "🧢", "🦂", "👤", "🤖", "👽", "🧙", "🦸", "🦹", "👻", "💀", "🎪"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Персонажі ({characters?.length || 0})
        </h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Додати персонажа
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новий персонаж</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID персонажа *</Label>
                  <Input
                    value={formData.character_id}
                    onChange={(e) => setFormData({ ...formData, character_id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="darth_vader"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ім'я *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Дарт Вейдер"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Аватар (емодзі)</Label>
                <div className="flex gap-2 flex-wrap">
                  {emojiOptions.map((emoji) => (
                    <Button
                      key={emoji}
                      type="button"
                      variant={formData.avatar === emoji ? "default" : "outline"}
                      size="sm"
                      className="text-xl w-10 h-10 p-0"
                      onClick={() => setFormData({ ...formData, avatar: emoji })}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
                <Input
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="Або введіть власний емодзі"
                  className="mt-2"
                />
              </div>

              <div className="space-y-2">
                <Label>Опис</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Короткий опис персонажа"
                />
              </div>

              <div className="space-y-2">
                <Label>Стиль нарратива *</Label>
                <Textarea
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  placeholder="Говорить низьким голосом, використовує темні метафори..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Активний (бере участь у генерації)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Скасувати
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Збереження..." : "Створити"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCharacter} onOpenChange={(open) => !open && setEditingCharacter(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редагувати персонажа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID персонажа *</Label>
                <Input
                  value={formData.character_id}
                  onChange={(e) => setFormData({ ...formData, character_id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="darth_vader"
                />
              </div>
              <div className="space-y-2">
                <Label>Ім'я *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Дарт Вейдер"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Аватар (емодзі)</Label>
              <div className="flex gap-2 flex-wrap">
                {emojiOptions.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant={formData.avatar === emoji ? "default" : "outline"}
                    size="sm"
                    className="text-xl w-10 h-10 p-0"
                    onClick={() => setFormData({ ...formData, avatar: emoji })}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
              <Input
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                placeholder="Або введіть власний емодзі"
                className="mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Опис</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Короткий опис персонажа"
              />
            </div>

            <div className="space-y-2">
              <Label>Стиль нарратива *</Label>
              <Textarea
                value={formData.style}
                onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                placeholder="Говорить низьким голосом, використовує темні метафори..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Активний (бере участь у генерації)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCharacter(null)}>
              Скасувати
            </Button>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Characters Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {characters?.map((character) => (
          <Card key={character.id} className={!character.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{character.avatar}</span>
                  <div>
                    <CardTitle className="text-base">{character.name}</CardTitle>
                    <code className="text-xs text-muted-foreground">{character.character_id}</code>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(character)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(character.id, character.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {character.description && (
                <p className="text-sm text-muted-foreground">{character.description}</p>
              )}
              <div className="text-sm bg-muted/50 p-2 rounded-md">
                <span className="font-medium">Стиль:</span> {character.style}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={character.is_active ? "default" : "secondary"}>
                  {character.is_active ? "Активний" : "Неактивний"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {characters?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Персонажі відсутні. Додайте першого персонажа.
        </div>
      )}
    </div>
  );
}
