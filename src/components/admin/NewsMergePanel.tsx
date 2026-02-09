import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, GitMerge, Play, Eye, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAdminStore } from "@/stores/adminStore";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callMergeApi(password: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ password, ...params }).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/merge-news?${qs}`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

interface MergeStats {
  total_groups: number;
  total_merged_items: number;
  recent_groups: {
    id: string;
    title: string;
    title_en: string | null;
    slug: string | null;
    merged_count: number;
    source_feeds: { name: string; news_id: string; country_code?: string }[];
    created_at: string;
  }[];
}

interface ScanResult {
  message: string;
  threshold: number;
  hours_back: number;
  total_scanned: number;
  groups: {
    count: number;
    titles: string[];
    feeds: string[];
    similarity: string;
    news_ids?: string[];
    slugs?: string[];
    country_codes?: string[];
  }[];
}

export function NewsMergePanel() {
  const { password } = useAdminStore();
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState(0.55);
  const [hoursBack, setHoursBack] = useState(72);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<MergeStats>({
    queryKey: ['merge-stats'],
    queryFn: () => callMergeApi(password, { action: 'stats' }) as Promise<MergeStats>,
  });

  const scanMutation = useMutation({
    mutationFn: () => callMergeApi(password, {
      action: 'scan',
      threshold: threshold.toString(),
      hours: hoursBack.toString(),
    }) as Promise<ScanResult>,
    onSuccess: (data) => {
      setScanResult(data);
      toast.success(`Знайдено ${data.groups?.length || 0} груп дублікатів`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeMutation = useMutation({
    mutationFn: () => callMergeApi(password, {
      action: 'merge',
      threshold: threshold.toString(),
      hours: hoursBack.toString(),
    }),
    onSuccess: (data: any) => {
      toast.success(`Створено ${data.groups_created} об'єднаних груп`);
      queryClient.invalidateQueries({ queryKey: ['merge-stats'] });
      setScanResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{stats?.total_groups || 0}</div>
            <p className="text-xs text-muted-foreground">Груп об'єднано</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{stats?.total_merged_items || 0}</div>
            <p className="text-xs text-muted-foreground">Новин у групах</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">
              {stats?.total_groups ? ((stats.total_merged_items / stats.total_groups).toFixed(1)) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Середній розмір</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary" />
            Дедуплікація новин
          </CardTitle>
          <CardDescription>
            Знаходить схожі новини з різних джерел та об'єднує їх в одну групу
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Поріг схожості: {(threshold * 100).toFixed(0)}%</Label>
              <Slider
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
                min={0.3}
                max={0.9}
                step={0.05}
              />
              <p className="text-xs text-muted-foreground">
                Менше = більше збігів, більше = точніші збіги
              </p>
            </div>
            <div className="space-y-2">
              <Label>Період пошуку: {hoursBack}г</Label>
              <Slider
                value={[hoursBack]}
                onValueChange={([v]) => setHoursBack(v)}
                min={12}
                max={168}
                step={12}
              />
              <p className="text-xs text-muted-foreground">
                Скільки годин назад шукати дублікати
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              variant="outline"
            >
              {scanMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Сканувати
            </Button>
            <Button
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
            >
              {mergeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Об'єднати
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResult && scanResult.groups && scanResult.groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Знайдено {scanResult.groups.length} груп ({scanResult.total_scanned} проскановано)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scanResult.groups.map((group, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{group.count} джерел</Badge>
                    <Badge variant="outline">~{(parseFloat(group.similarity) * 100).toFixed(0)}%</Badge>
                  </div>
                  {group.titles.map((title, ti) => (
                    <div key={ti} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {group.feeds[ti]}
                      </Badge>
                      <span className="text-muted-foreground line-clamp-1">{title}</span>
                    </div>
                  ))}
                  {group.news_ids && group.news_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.news_ids.map((nid: string, ni: number) => (
                        <a
                          key={ni}
                          href={`/news/${group.country_codes?.[ni] || 'us'}/${group.slugs?.[ni] || nid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline"
                        >
                          🔗 {group.feeds[ni] || `#${ni + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Groups */}
      {stats?.recent_groups && stats.recent_groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Newspaper className="w-4 h-4" />
              Останні об'єднання
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats.recent_groups.map((group) => (
                <div key={group.id} className="flex items-center gap-3 p-2 border border-border/50 rounded">
                  <Badge variant="secondary" className="shrink-0">
                    {group.merged_count}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/news/${(group.source_feeds as any)?.[0]?.country_code || 'us'}/${group.slug || group.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium line-clamp-1 hover:text-primary hover:underline"
                    >
                      {group.title_en || group.title}
                    </a>
                    <div className="flex gap-1 mt-0.5">
                      {group.source_feeds.map((sf: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1">
                          {sf.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
