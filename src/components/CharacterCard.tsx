import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Heart, Swords, MessageSquare, TrendingUp, Plus, X } from "lucide-react";
import { adminAction } from "@/lib/api";

interface Character {
  id: string;
  character_id: string;
  name: string;
  avatar: string;
  style: string;
  description: string | null;
  is_active: boolean;
  dialogue_count: number;
  total_likes: number;
  last_dialogue_at: string | null;
}

interface CharacterRelationship {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: "friendly" | "hostile" | "neutral";
  strength: number;
  description: string | null;
  related_character: Character;
}

interface CharacterCardProps {
  character: Character;
  password: string;
  allCharacters: Character[];
}

export function CharacterCard({ character, password, allCharacters }: CharacterCardProps) {
  const queryClient = useQueryClient();
  const [isRelationshipDialogOpen, setIsRelationshipDialogOpen] = useState(false);
  const [newRelationship, setNewRelationship] = useState({
    related_character_id: "",
    relationship_type: "neutral" as "friendly" | "hostile" | "neutral",
    strength: 50,
    description: "",
  });

  // Fetch relationships
  const { data: relationships } = useQuery({
    queryKey: ["character-relationships", character.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_relationships")
        .select(`
          id,
          character_id,
          related_character_id,
          relationship_type,
          strength,
          description
        `)
        .eq("character_id", character.id);
      if (error) throw error;
      
      // Map related character data
      return data.map((rel) => ({
        ...rel,
        related_character: allCharacters.find((c) => c.id === rel.related_character_id)!,
      })).filter((rel) => rel.related_character) as CharacterRelationship[];
    },
    enabled: !!character.id && allCharacters.length > 0,
  });

  const addRelationshipMutation = useMutation({
    mutationFn: async () => {
      return adminAction("createRelationship", password, {
        character_id: character.id,
        ...newRelationship,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-relationships", character.id] });
      toast.success("Зв'язок додано");
      setIsRelationshipDialogOpen(false);
      setNewRelationship({ related_character_id: "", relationship_type: "neutral", strength: 50, description: "" });
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return adminAction("deleteRelationship", password, { id: relationshipId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-relationships", character.id] });
      toast.success("Зв'язок видалено");
    },
    onError: (error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const friendlyCount = relationships?.filter((r) => r.relationship_type === "friendly").length || 0;
  const hostileCount = relationships?.filter((r) => r.relationship_type === "hostile").length || 0;

  const availableCharacters = allCharacters.filter(
    (c) => c.id !== character.id && !relationships?.some((r) => r.related_character_id === c.id)
  );

  return (
    <>
      <Card className={!character.is_active ? "opacity-60" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{character.avatar}</span>
              <div>
                <CardTitle className="text-lg">{character.name}</CardTitle>
                <code className="text-xs text-muted-foreground">{character.character_id}</code>
              </div>
            </div>
            <Badge variant={character.is_active ? "default" : "secondary"}>
              {character.is_active ? "Активний" : "Неактивний"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 p-2 rounded">
              <div className="flex items-center justify-center gap-1">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="font-bold">{character.dialogue_count}</span>
              </div>
              <p className="text-xs text-muted-foreground">Діалогів</p>
            </div>
            <div className="bg-muted/50 p-2 rounded">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-bold">{character.total_likes}</span>
              </div>
              <p className="text-xs text-muted-foreground">Лайків</p>
            </div>
            <div className="bg-muted/50 p-2 rounded">
              <div className="flex items-center justify-center gap-1">
                <Heart className="h-4 w-4 text-pink-500" />
                <span className="font-bold text-green-600">{friendlyCount}</span>
                <span>/</span>
                <Swords className="h-4 w-4 text-red-500" />
                <span className="font-bold text-red-600">{hostileCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Зв'язки</p>
            </div>
          </div>

          {/* Description */}
          {character.description && (
            <p className="text-sm text-muted-foreground">{character.description}</p>
          )}

          {/* Relationships */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Зв'язки з персонажами</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRelationshipDialogOpen(true)}
                disabled={availableCharacters.length === 0}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[120px]">
              <div className="space-y-1">
                {relationships?.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{rel.related_character.avatar}</span>
                      <span>{rel.related_character.name}</span>
                      {rel.relationship_type === "friendly" && (
                        <Heart className="h-3 w-3 text-pink-500" />
                      )}
                      {rel.relationship_type === "hostile" && (
                        <Swords className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({rel.strength}%)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteRelationshipMutation.mutate(rel.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {(!relationships || relationships.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Немає зв'язків
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Add Relationship Dialog */}
      <Dialog open={isRelationshipDialogOpen} onOpenChange={setIsRelationshipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати зв'язок для {character.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Персонаж</Label>
              <Select
                value={newRelationship.related_character_id}
                onValueChange={(v) => setNewRelationship({ ...newRelationship, related_character_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Виберіть персонажа" />
                </SelectTrigger>
                <SelectContent>
                  {availableCharacters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.avatar} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Тип зв'язку</Label>
              <Select
                value={newRelationship.relationship_type}
                onValueChange={(v) => setNewRelationship({ ...newRelationship, relationship_type: v as "friendly" | "hostile" | "neutral" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-500" />
                      Дружній
                    </div>
                  </SelectItem>
                  <SelectItem value="hostile">
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-red-500" />
                      Ворожий
                    </div>
                  </SelectItem>
                  <SelectItem value="neutral">Нейтральний</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сила зв'язку: {newRelationship.strength}%</Label>
              <Slider
                value={[newRelationship.strength]}
                onValueChange={(v) => setNewRelationship({ ...newRelationship, strength: v[0] })}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Опис (опціонально)</Label>
              <Textarea
                value={newRelationship.description}
                onChange={(e) => setNewRelationship({ ...newRelationship, description: e.target.value })}
                placeholder="Чому вони друзі/вороги..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRelationshipDialogOpen(false)}>
              Скасувати
            </Button>
            <Button
              onClick={() => addRelationshipMutation.mutate()}
              disabled={!newRelationship.related_character_id || addRelationshipMutation.isPending}
            >
              {addRelationshipMutation.isPending ? "Збереження..." : "Додати"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
