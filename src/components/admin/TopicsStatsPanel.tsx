import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Tags, TrendingUp, Hash, Loader2, Pencil, Save, X, Check, ChevronRight, FileText, Search, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { adminAction } from "@/lib/api";

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (fast)', provider: 'gemini' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (precise)', provider: 'gemini' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'openai' },
  { value: 'GLM-4.7', label: 'Z.AI GLM-4.7 (strongest)', provider: 'zai' },
  { value: 'GLM-4.7-Flash', label: 'Z.AI GLM-4.7-Flash (fast)', provider: 'zai' },
  { value: 'deepseek-chat', label: 'DeepSeek-V3 (fast)', provider: 'deepseek' },
  { value: 'deepseek-reasoner', label: 'DeepSeek-R1 (reasoning)', provider: 'deepseek' },
];

const DEFAULT_AI_PROMPT = `Make a deep analysis of the latest news.
Add quotes and interesting facts.
Add charts made with special characters.
Add a list of important URLs.
Write in simple English.`;

interface TopicStat {
  topic: string;
  count: number;
}

interface TopicMeta {
  topic: string;
  description: string | null;
  description_en: string | null;
  seo_text: string | null;
  seo_text_en: string | null;
  seo_keywords: string | null;
  seo_keywords_en: string | null;
  updated_at: string | null;
}

const EMPTY_META: Omit<TopicMeta, "topic" | "updated_at"> = {
  description: "",
  description_en: "",
  seo_text: "",
  seo_text_en: "",
  seo_keywords: "",
  seo_keywords_en: "",
};

export function TopicsStatsPanel({ password }: { password: string }) {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Omit<TopicMeta, "topic" | "updated_at">>(EMPTY_META);
  const [saved, setSaved] = useState(false);
  const [aiModel, setAiModel] = useState('GLM-4.7-Flash');
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [aiGenerating, setAiGenerating] = useState(false);

  // ── Fetch all topics stats ──────────────────────────────────────────────
  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["topics-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("themes")
        .not("themes", "is", null);
      if (error) throw error;

      const topicCounts = new Map<string, number>();
      let totalTopicsCount = 0;
      for (const item of data || []) {
        if (item.themes && Array.isArray(item.themes)) {
          for (const theme of item.themes) {
            if (theme && typeof theme === "string") {
              totalTopicsCount++;
              topicCounts.set(theme, (topicCounts.get(theme) || 0) + 1);
            }
          }
        }
      }
      const topicsArray: TopicStat[] = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);
      return { totalUnique: topicCounts.size, totalMentions: totalTopicsCount, top100: topicsArray.slice(0, 100), all: topicsArray };
    },
    enabled: !!password,
  });

  // ── Fetch all existing topic_meta ───────────────────────────────────────
  const { data: allMeta = [] } = useQuery<TopicMeta[]>({
    queryKey: ["topic-meta-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("topic_meta").select("*");
      if (error) throw error;
      return (data || []) as TopicMeta[];
    },
    enabled: !!password,
  });

  const metaMap = new Map(allMeta.map((m) => [m.topic, m]));

  // ── Fetch meta for selected topic ───────────────────────────────────────
  const { data: selectedMeta, isLoading: metaLoading } = useQuery<TopicMeta | null>({
    queryKey: ["topic-meta", selectedTopic],
    queryFn: async () => {
      if (!selectedTopic) return null;
      const { data } = await (supabase as any).from("topic_meta").select("*").eq("topic", selectedTopic).maybeSingle();
      return (data as unknown as TopicMeta | null);
    },
    enabled: !!selectedTopic,
  });

  // Populate form when selectedMeta loads
  useEffect(() => {
    if (selectedMeta !== undefined) {
      setForm({
        description: selectedMeta?.description ?? "",
        description_en: selectedMeta?.description_en ?? "",
        seo_text: selectedMeta?.seo_text ?? "",
        seo_text_en: selectedMeta?.seo_text_en ?? "",
        seo_keywords: selectedMeta?.seo_keywords ?? "",
        seo_keywords_en: selectedMeta?.seo_keywords_en ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeta]);

  // ── AI Generate ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTopic) return;
    const modelObj = AI_MODELS.find(m => m.value === aiModel);
    if (!modelObj) return;
    setAiGenerating(true);
    try {
      const result = await adminAction<{
        success: boolean;
        description_en: string;
        seo_text_en: string;
        seo_keywords_en: string;
        error?: string;
      }>('generateTopicMeta', password, {
        topic: selectedTopic,
        model: modelObj.value,
        provider: modelObj.provider,
        prompt: aiPrompt,
      });
      if (result.success) {
        setForm(f => ({
          ...f,
          description_en: result.description_en || f.description_en,
          seo_text_en: result.seo_text_en || f.seo_text_en,
          seo_keywords_en: result.seo_keywords_en || f.seo_keywords_en,
        }));
        toast({ title: "Generated!", description: `AI analysis ready for "${selectedTopic}"` });
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (err: any) {
      toast({ title: "Generation error", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Save mutation ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTopic) throw new Error("No topic selected");
      // EN is the source of truth; copy to all-language fields
      const { error } = await (supabase as any).from("topic_meta").upsert({
        topic: selectedTopic,
        description: form.description_en,
        description_en: form.description_en,
        seo_text: form.seo_text_en,
        seo_text_en: form.seo_text_en,
        seo_keywords: form.seo_keywords_en,
        seo_keywords_en: form.seo_keywords_en,
        updated_at: new Date().toISOString(),
      }, { onConflict: "topic" });
      if (error) throw error;
    },  
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["topic-meta-all"] });
      queryClient.invalidateQueries({ queryKey: ["topic-meta", selectedTopic] });
      queryClient.invalidateQueries({ queryKey: ["topic-meta-page", selectedTopic] });
      toast({ title: "Збережено", description: `Метадані для «${selectedTopic}» оновлено.` });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: Error) => {
      toast({ title: "Помилка", description: err.message, variant: "destructive" });
    },
  });

  const handleSelectTopic = (topic: string) => {
    setSaved(false);
    setSelectedTopic(topic);
  };

  const handleClear = () => {
    setSelectedTopic(null);
    setForm(EMPTY_META);
    setSaved(false);
  };

  const filtered = topicsData
    ? topicsData.all.filter((t) => t.topic.toLowerCase().includes(search.toLowerCase()))
    : [];

  // ── Loading / empty states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!topicsData) {
    return (
      <Card className="cosmic-card">
        <CardHeader><CardTitle>Немає даних</CardTitle></CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cosmic-card border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Hash className="w-8 h-8 text-primary" />
              <div>
                <p className="text-3xl font-bold text-glow">{topicsData.totalUnique}</p>
                <p className="text-sm text-muted-foreground font-mono">Унікальних Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cosmic-card border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tags className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-3xl font-bold text-glow">{topicsData.totalMentions}</p>
                <p className="text-sm text-muted-foreground font-mono">Всього згадувань</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cosmic-card border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-3xl font-bold text-glow">
                  {topicsData.totalMentions > 0
                    ? (topicsData.totalMentions / topicsData.totalUnique).toFixed(1)
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground font-mono">Середня частота</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main layout: table + editor ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Topics table */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Всі Topics
            </CardTitle>
            <CardDescription>Клікніть на тему, щоб редагувати опис та SEO</CardDescription>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Пошук теми..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full rounded-md border border-primary/20">
              <div className="p-2">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                    <tr className="border-b border-primary/20">
                      <th className="text-left p-2 font-mono text-xs text-muted-foreground w-10">#</th>
                      <th className="text-left p-2 font-mono text-xs text-muted-foreground">Topic</th>
                      <th className="text-right p-2 font-mono text-xs text-muted-foreground w-20">Кіл-ть</th>
                      <th className="text-center p-2 font-mono text-xs text-muted-foreground w-12">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((topic, index) => {
                      const meta = metaMap.get(topic.topic);
                      const hasMeta = meta && (meta.description || meta.seo_text);
                      const isSelected = selectedTopic === topic.topic;
                      return (
                        <tr
                          key={topic.topic}
                          onClick={() => handleSelectTopic(topic.topic)}
                          className={`border-b border-primary/10 cursor-pointer transition-colors ${
                            isSelected ? "bg-primary/15 border-primary/30" : "hover:bg-primary/5"
                          }`}
                        >
                          <td className="p-2 font-mono text-xs text-muted-foreground">{index + 1}</td>
                          <td className="p-2 font-medium text-sm">
                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <ChevronRight className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <Tags className="w-3.5 h-3.5 text-primary/50" />
                              )}
                              {topic.topic}
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono text-sm font-bold text-primary">{topic.count}</td>
                          <td className="p-2 text-center">
                            {hasMeta ? (
                              <FileText className="w-3.5 h-3.5 text-green-400 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Editor panel */}
        <Card className="cosmic-card border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="w-4 h-4 text-primary" />
                {selectedTopic ? (
                  <span>Редагування: <span className="text-primary">«{selectedTopic}»</span></span>
                ) : (
                  "Оберіть тему для редагування"
                )}
              </CardTitle>
              {selectedTopic && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {(selectedMeta as TopicMeta | null | undefined)?.updated_at && (
              <p className="text-xs text-muted-foreground font-mono">
                Оновлено: {new Date((selectedMeta as TopicMeta).updated_at!).toLocaleString("uk")}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedTopic ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                <Tags className="w-10 h-10 opacity-20" />
                <p className="text-sm">Клікніть на будь-яку тему<br />у таблиці зліва</p>
              </div>
            ) : metaLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── AI Generate section ── */}
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <p className="text-xs font-mono text-primary font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate with AI
                  </p>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(m => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={5}
                    className="text-xs font-mono resize-none"
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={handleGenerate}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiGenerating ? 'Generating...' : 'Generate'}
                  </Button>
                </div>

                {/* ── English fields ── */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">Short description (EN)</Label>
                  <Textarea
                    value={form.description_en ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                    placeholder="Short category description for the card and meta tags..."
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">SEO text (EN)</Label>
                  <Textarea
                    value={form.seo_text_en ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, seo_text_en: e.target.value }))}
                    placeholder="Extended SEO text for the bottom of the topic page..."
                    rows={9}
                    className="text-sm resize-none font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground">SEO keywords (EN, comma-separated)</Label>
                  <Input
                    value={form.seo_keywords_en ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, seo_keywords_en: e.target.value }))}
                    placeholder="keyword1, keyword2, keyword3"
                    className="text-sm font-mono"
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saved ? "Saved!" : "Save"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Extended stats ─────────────────────────────────────────────────── */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono">Детальна статистика</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Топ-10 складають:</span>
            <span className="font-bold">
              {topicsData.top100.slice(0, 10).reduce((sum, t) => sum + t.count, 0)} згадувань
              {" "}
              ({((topicsData.top100.slice(0, 10).reduce((sum, t) => sum + t.count, 0) / topicsData.totalMentions) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Топ-50 складають:</span>
            <span className="font-bold">
              {topicsData.top100.slice(0, 50).reduce((sum, t) => sum + t.count, 0)} згадувань
              {" "}
              ({((topicsData.top100.slice(0, 50).reduce((sum, t) => sum + t.count, 0) / topicsData.totalMentions) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Рідкісні топіки (1-2 згадки):</span>
            <span className="font-bold">{topicsData.all.filter((t) => t.count <= 2).length} топіків</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Тем з описом (заповнені):</span>
            <span className="font-bold text-green-400">{allMeta.filter((m) => m.description).length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

