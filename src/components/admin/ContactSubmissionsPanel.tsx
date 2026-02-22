import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, CheckCircle2, Clock, MailOpen, Filter, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { adminAction } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

interface Submission {
  id: string;
  created_at: string;
  topic: string;
  name: string | null;
  email: string | null;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  language: string | null;
  screen_resolution: string | null;
  timezone: string | null;
  status: string;
  ai_analysis: string | null;
  ai_analyzed_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  read:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  resolved: "bg-green-500/15 text-green-400 border-green-500/30",
  spam:     "bg-red-500/15 text-red-400 border-red-500/30",
};

const TOPIC_LABELS: Record<string, string> = {
  copyright:   "Авторські права",
  partnership: "Партнерство",
  advertising: "Реклама",
  technical:   "Технічне",
  cooperation: "Співпраця",
  other:       "Інше",
};

export function ContactSubmissionsPanel({ password }: { password: string }) {
  const queryClient = useQueryClient();
  const [filterTopic, setFilterTopic]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [analyzing, setAnalyzing]       = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);

  // ── Fetch submissions ──────────────────────────────────────────────────
  const { data: submissions, isLoading, refetch } = useQuery<Submission[]>({
    queryKey: ["contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Submission[];
    },
  });

  const filtered = (submissions ?? []).filter((s) => {
    const topicOk  = filterTopic  === "all" || s.topic  === filterTopic;
    const statusOk = filterStatus === "all" || s.status === filterStatus;
    return topicOk && statusOk;
  });

  // ── Analyze with AI ────────────────────────────────────────────────────
  const handleAnalyze = async (sub: Submission) => {
    setAnalyzing(sub.id);
    try {
      const result = await adminAction<{ analysis: string }>(
        "analyzeContactSubmission",
        password,
        {
          id:      sub.id,
          topic:   sub.topic,
          name:    sub.name,
          email:   sub.email,
          message: sub.message,
        }
      );
      toast({ title: "Аналіз завершено", description: result.analysis.slice(0, 120) + "…" });
      queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
    } catch (err) {
      toast({ title: "Помилка аналізу", variant: "destructive" });
      console.error(err);
    } finally {
      setAnalyzing(null);
    }
  };

  // ── Update status ──────────────────────────────────────────────────────
  const handleStatus = async (id: string, status: string) => {
    setUpdatingStatus(id);
    try {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
    } catch (err) {
      toast({ title: "Помилка оновлення статусу", variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("uk-UA", {
      day:    "2-digit",
      month:  "2-digit",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });

  const uniqueTopics   = Array.from(new Set((submissions ?? []).map((s) => s.topic)));
  const totalNew       = (submissions ?? []).filter((s) => s.status === "new").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MailOpen className="w-5 h-5 text-primary" />
            Зворотній зв'язок
          </h2>
          <p className="text-sm text-muted-foreground">
            Всього: {submissions?.length ?? 0} &nbsp;·&nbsp;
            <span className="text-blue-400">Нові: {totalNew}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Оновити
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterTopic} onValueChange={setFilterTopic}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Тема" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі теми</SelectItem>
              {uniqueTopics.map((t) => (
                <SelectItem key={t} value={t}>
                  {TOPIC_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі статуси</SelectItem>
            <SelectItem value="new">Нові</SelectItem>
            <SelectItem value="read">Прочитані</SelectItem>
            <SelectItem value="resolved">Вирішені</SelectItem>
            <SelectItem value="spam">Спам</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Немає звернень</p>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3 pr-2">
            {filtered.map((sub) => (
              <Card
                key={sub.id}
                className="border-border/50 bg-card/60 hover:border-border transition-colors"
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {/* Left: badge + name + date */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono"
                      >
                        {TOPIC_LABELS[sub.topic] ?? sub.topic}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[sub.status] ?? ""}`}
                      >
                        {sub.status === "new"      ? "Нове"
                          : sub.status === "read"  ? "Прочитано"
                          : sub.status === "resolved" ? "Вирішено"
                          : sub.status === "spam"  ? "Спам"
                          : sub.status}
                      </Badge>
                      {sub.name && (
                        <span className="text-sm font-medium">{sub.name}</span>
                      )}
                      {sub.email && (
                        <span className="text-sm text-muted-foreground">{sub.email}</span>
                      )}
                    </div>
                    {/* Right: date */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(sub.created_at)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Message */}
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap cursor-pointer ${
                      expanded === sub.id ? "" : "line-clamp-3"
                    }`}
                    onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                  >
                    {sub.message}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                    {sub.timezone && <span>🕐 {sub.timezone}</span>}
                    {sub.language && <span>🌐 {sub.language}</span>}
                    {sub.screen_resolution && <span>🖥 {sub.screen_resolution}</span>}
                    {sub.referrer && (
                      <span title={sub.referrer}>
                        🔗 {sub.referrer.length > 40 ? sub.referrer.slice(0, 40) + "…" : sub.referrer}
                      </span>
                    )}
                  </div>

                  {/* UA */}
                  {sub.user_agent && (
                    <p className="text-xs text-muted-foreground/60 font-mono truncate" title={sub.user_agent}>
                      UA: {sub.user_agent}
                    </p>
                  )}

                  {/* AI Analysis */}
                  {sub.ai_analysis && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs font-semibold text-violet-400 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Аналіз
                        {sub.ai_analyzed_at && (
                          <span className="ml-auto font-normal text-muted-foreground">
                            {formatDate(sub.ai_analyzed_at)}
                          </span>
                        )}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                        {sub.ai_analysis}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Status change */}
                    {sub.status !== "read" && sub.status !== "resolved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={updatingStatus === sub.id}
                        onClick={() => handleStatus(sub.id, "read")}
                      >
                        {updatingStatus === sub.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <MailOpen className="w-3 h-3" />
                        )}
                        Прочитано
                      </Button>
                    )}
                    {sub.status !== "resolved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        disabled={updatingStatus === sub.id}
                        onClick={() => handleStatus(sub.id, "resolved")}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Вирішено
                      </Button>
                    )}
                    {sub.status !== "spam" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        disabled={updatingStatus === sub.id}
                        onClick={() => handleStatus(sub.id, "spam")}
                      >
                        Спам
                      </Button>
                    )}

                    {/* AI Analyze */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 ml-auto border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                      disabled={analyzing === sub.id}
                      onClick={() => handleAnalyze(sub)}
                    >
                      {analyzing === sub.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {sub.ai_analysis ? "Повторний аналіз" : "Аналізувати AI"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
