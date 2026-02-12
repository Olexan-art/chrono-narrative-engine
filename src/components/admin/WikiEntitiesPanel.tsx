import { useQuery } from "@tanstack/react-query";
import { Globe, ExternalLink, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WikiEntity {
  id: string;
  name: string;
  wiki_url: string | null;
  entity_type: string;
  description: string | null;
  created_at: string;
}

export function WikiEntitiesPanel() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: entities, isLoading } = useQuery({
    queryKey: ["wiki-entities", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("wiki_entities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WikiEntity[];
    }
  });

  return (
    <Card className="cosmic-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Wiki Entities — Сутності з Wikipedia
        </CardTitle>
        <CardDescription>
          Автоматично розпізнані сутності з новин та їх Wikipedia посилання
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Пошук сутностей..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Завантаження...
          </div>
        ) : entities && entities.length > 0 ? (
          <div className="space-y-2">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="p-4 border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 rounded">
                        {entity.entity_type}
                      </span>
                    </div>
                    {entity.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {entity.description}
                      </p>
                    )}
                  </div>
                  {entity.wiki_url && (
                    <a
                      href={entity.wiki_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Нічого не знайдено" : "Немає сутностей"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
