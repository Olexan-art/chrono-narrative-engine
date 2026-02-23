import { useState, useRef } from "react";
import { Sparkles, Play, Square, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/api";
import { toast } from "sonner";

interface NewsItem {
  id: string;
  title: string;
  keywords: string[] | null;
}

interface JobResult {
  newsId: string;
  title: string;
  status: "ok" | "empty" | "error";
  count?: number;
  error?: string;
}

const DELAY_MS = 1200; // throttle: 1.2s between requests to avoid rate limiting

export function BatchEntitySearchPanel() {
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [total, setTotal]         = useState(0);
  const [results, setResults]     = useState<JobResult[]>([]);
  const [log, setLog]             = useState<string[]>([]);
  const [phase, setPhase]         = useState<"idle" | "loading" | "running" | "done">("idle");
  const abortRef                  = useRef(false);

  const addLog = (msg: string) =>
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200));

  async function start() {
    abortRef.current = false;
    setResults([]);
    setLog([]);
    setProgress(0);
    setTotal(0);
    setPhase("loading");
    setRunning(true);

    try {
      // 1. Load all news_wiki_entities to know which news already have entities
      addLog("Завантаження списку новин без сутностей...");

      const { data: linked, error: linkErr } = await supabase
        .from("news_wiki_entities")
        .select("news_item_id");

      if (linkErr) throw new Error(`Помилка читання news_wiki_entities: ${linkErr.message}`);

      const linkedIds = new Set((linked ?? []).map((r: any) => r.news_item_id as string));

      // 2. Load recent news items (last 1000, sorted newest first)
      const { data: allNews, error: newsErr } = await supabase
        .from("news_items")
        .select("id, title, keywords")
        .order("published_at", { ascending: false })
        .limit(1000);

      if (newsErr) throw new Error(`Помилка читання news_items: ${newsErr.message}`);

      const queue: NewsItem[] = (allNews ?? []).filter((n: any) => !linkedIds.has(n.id));
      setTotal(queue.length);

      if (queue.length === 0) {
        addLog("✅ Всі новини вже мають сутності — нічого робити.");
        setPhase("done");
        setRunning(false);
        toast.success("Всі новини вже мають сутності");
        return;
      }

      addLog(`Знайдено ${queue.length} новин без сутностей. Запускаємо auto-search...`);
      setPhase("running");

      let done = 0;
      let foundCount = 0;

      for (const news of queue) {
        if (abortRef.current) {
          addLog("⛔ Зупинено вручну.");
          break;
        }

        try {
          const result = await callEdgeFunction<{
            success: boolean;
            entities: Array<{ id: string }>;
            error?: string;
          }>("search-wiki", {
            newsId: news.id,
            title:  news.title,
            keywords: news.keywords ?? [],
            language: "en",
          });

          const count = result.entities?.length ?? 0;
          if (count > 0) foundCount++;
          const jobResult: JobResult = {
            newsId: news.id,
            title:  news.title,
            status: result.success ? (count > 0 ? "ok" : "empty") : "error",
            count,
            error: result.error,
          };
          setResults(prev => [jobResult, ...prev]);
          addLog(
            result.success
              ? count > 0
                ? `✅ «${news.title.slice(0, 60)}» → ${count} сутн.`
                : `◻ «${news.title.slice(0, 60)}» → 0 сутностей`
              : `❌ «${news.title.slice(0, 60)}» → ${result.error ?? "помилка"}`
          );
        } catch (e: any) {
          const jobResult: JobResult = {
            newsId: news.id,
            title:  news.title,
            status: "error",
            error:  e.message,
          };
          setResults(prev => [jobResult, ...prev]);
          addLog(`❌ «${news.title.slice(0, 60)}» → ${e.message}`);
        }

        done++;
        setProgress(done);

        // throttle
        if (!abortRef.current) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      }

      setPhase("done");
      setRunning(false);
      toast.success(`Завершено: оброблено ${done}, знайдено сутності — ${foundCount}`);
      addLog(`✅ Завершено. Оброблено: ${done}, знайдено: ${foundCount}`);
    } catch (e: any) {
      addLog(`💥 Критична помилка: ${e.message}`);
      toast.error(e.message);
      setPhase("done");
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current = true;
  }

  function reset() {
    setPhase("idle");
    setResults([]);
    setLog([]);
    setProgress(0);
    setTotal(0);
  }

  const okCount    = results.filter(r => r.status === "ok").length;
  const emptyCount = results.filter(r => r.status === "empty").length;
  const errCount   = results.filter(r => r.status === "error").length;
  const pct        = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <Card className="border-violet-800/40 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-violet-400" />
          Batch Auto-Search: Mentioned Entities
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Перебирає всі новини без сутностей та запускає <code className="text-xs bg-muted px-1 rounded">search-wiki</code> для кожної.
          Затримка {DELAY_MS}ms між запитами.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {phase === "idle" || phase === "done" ? (
            <Button
              onClick={start}
              className="gap-2 bg-violet-700 hover:bg-violet-600"
              disabled={running}
            >
              <Play className="w-4 h-4" />
              {phase === "done" ? "Запустити знову" : "Запустити"}
            </Button>
          ) : (
            <Button
              onClick={stop}
              variant="destructive"
              className="gap-2"
              disabled={!running}
            >
              <Square className="w-4 h-4" />
              Зупинити
            </Button>
          )}
          {phase !== "idle" && (
            <Button variant="outline" size="sm" onClick={reset} disabled={running} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Скинути
            </Button>
          )}
          {phase !== "idle" && (
            <div className="flex gap-2 text-sm flex-wrap">
              <Badge variant="outline" className="gap-1 text-green-400 border-green-700">
                <CheckCircle2 className="w-3 h-3" /> {okCount} знайдено
              </Badge>
              <Badge variant="outline" className="gap-1 text-muted-foreground border-muted">
                <Clock className="w-3 h-3" /> {emptyCount} порожніх
              </Badge>
              <Badge variant="outline" className="gap-1 text-red-400 border-red-800">
                <XCircle className="w-3 h-3" /> {errCount} помилок
              </Badge>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {(phase === "running" || phase === "loading") && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{phase === "loading" ? "Завантаження..." : `${progress} / ${total}`}</span>
              <span>{pct}%</span>
            </div>
            <Progress value={phase === "loading" ? 0 : pct} className="h-2" />
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Завершено: {progress} новин оброблено, {okCount} отримали сутності.
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="rounded border border-border bg-muted/30 p-3 h-52 overflow-y-auto font-mono text-xs space-y-0.5">
            {log.map((line, i) => (
              <div
                key={i}
                className={
                  line.includes("✅") ? "text-green-400" :
                  line.includes("❌") || line.includes("💥") ? "text-red-400" :
                  line.includes("⛔") ? "text-yellow-400" :
                  "text-muted-foreground"
                }
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
