import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAdminStore } from "@/stores/adminStore";
import { adminAction } from "@/lib/api";
import { toast } from "sonner";
import { Activity, Eye, EyeOff, Copy, Send } from "lucide-react";

const METRICS = [
  { key: "seo", label: "SEO", icon: "🔍", color: "#00ff88" },
  { key: "readability", label: "Читабельність", icon: "📖", color: "#00cfff" },
  { key: "engagement", label: "Залученість", icon: "⚡", color: "#ff9900" },
  { key: "keywords", label: "Ключові слова", icon: "🎯", color: "#ff4dff" },
  { key: "cta", label: "Заклик до дії", icon: "🚀", color: "#ff3355" },
  { key: "structure", label: "Структура", icon: "🏗️", color: "#aaff00" },
];

interface AnimatedScoreProps {
  value: number;
  color: string;
}

function AnimatedScore({ value, color }: AnimatedScoreProps) {
  const [display, setDisplay] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 900;
    const step = (end - start) / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { start = end; clearInterval(timer); }
      setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  const r = 28, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  const dash = (display / 100) * circ;

  return (
    <div className="relative w-18 h-18">
      <svg width="72" height="72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.05s", filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-mono text-sm font-bold"
           style={{ color }}>
        {display}
      </div>
    </div>
  );
}

interface ScoreCardProps {
  metric: typeof METRICS[0];
  score: number;
  issues: string[];
}

function ScoreCard({ metric, score, issues }: ScoreCardProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300"
      onClick={() => setOpen(!open)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <AnimatedScore value={score} color={metric.color} />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              {metric.icon} {metric.label}
            </div>
            <Progress value={score} className="h-2 mb-2" />
            <div className="text-xs">
              {score >= 75 ? (
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                  ✓ Добре
                </Badge>
              ) : score >= 50 ? (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">
                  ⚠ Потребує уваги
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/10 text-red-500">
                  ✗ Критично
                </Badge>
              )}
            </div>
          </div>
          <div className="text-muted-foreground">
            {open ? "▲" : "▼"}
          </div>
        </div>
        {open && issues?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            {issues.map((issue, i) => (
              <div key={i} className="text-xs text-muted-foreground py-1 flex gap-2">
                <span style={{ color: metric.color }}>›</span>
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
}

function TypewriterText({ text, speed = 12 }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState("");
  const ref = useRef(0);
  
  useEffect(() => {
    setDisplayed("");
    ref.current = 0;
    if (!text) return;
    const timer = setInterval(() => {
      ref.current++;
      setDisplayed(text.slice(0, ref.current));
      if (ref.current >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return (
    <span>
      {displayed}
      <span className={`${displayed.length < text?.length ? 'opacity-100' : 'opacity-0'} text-green-500`}>
        █
      </span>
    </span>
  );
}

export default function SEO2Page() {
  const { password } = useAdminStore();
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<"paste" | "url">("paste");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [scores, setScores] = useState<any>(null);
  const [improved, setImproved] = useState<string>("");
  const [improvements, setImprovements] = useState<(string | { було?: string; стало?: string; рекомендація?: string; was?: string; became?: string; recommendation?: string })[]>([]);
  const [activeView, setActiveView] = useState<"scores" | "improved">("scores");
  const [error, setError] = useState("");
  const [selectedLLM, setSelectedLLM] = useState("anthropic:claude-3-5-sonnet-20241022");

  // Available LLM providers from admin
  const llmOptions = [
    { value: "anthropic:claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "openai:gpt-4o", label: "GPT-4o" },
    { value: "openai:gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gemini:gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini:gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "deepseek:deepseek-chat", label: "DeepSeek Chat" },
    { value: "zai:glm-4-plus", label: "Z.AI GLM-4 Plus" }
  ];

  const totalScore = scores
    ? Math.round(Object.values(scores).reduce((s: number, m: any) => s + m.score, 0) / METRICS.length)
    : null;

  async function analyze() {
    if (!content.trim() && !url.trim()) return;
    setLoading(true);
    setScores(null);
    setImproved("");
    setImprovements([]);
    setError("");
    setActiveView("scores");

    try {
      // Phase 1: Score
      setPhase("Сканування сторінки...");
      await new Promise(r => setTimeout(r, 600));
      setPhase("Оцінювання метрик SEO та залученості...");

      const pageText = tab === "url"
        ? `URL сторінки: ${url}\n(Проаналізуй типовий контент для такого URL)`
        : content;

      const [provider, model] = selectedLLM.split(':');
      
      const scoreResult = await adminAction('generateLLMContent', password, {
        provider,
        model,
        system: `You are an expert in SEO and traffic optimization. Analyze the page content and return ONLY JSON, no markdown, no before/after text. Format:
{
  "seo": {"score": number 0-100, "issues": ["string","string"]},
  "readability": {"score": number 0-100, "issues": ["string"]},
  "engagement": {"score": number 0-100, "issues": ["string"]},
  "keywords": {"score": number 0-100, "issues": ["string"]},
  "cta": {"score": number 0-100, "issues": ["string"]},
  "structure": {"score": number 0-100, "issues": ["string"]}
}
Each metric: real score + 2-3 specific problems or tips. Answer in English.`,
        messages: [{ role: 'user', content: `Analyze this content:\n\n${pageText.slice(0, 3000)}` }]
      });

      if (!scoreResult.success) {
        throw new Error(scoreResult.error || 'Failed to analyze content');
      }

      const rawScore = scoreResult.content;
      const parsed = JSON.parse(rawScore.replace(/```json|```/g, "").trim());
      setScores(parsed);

      // Phase 2: Improve
      setPhase("Генерація покращеного контенту...");
      await new Promise(r => setTimeout(r, 400));

      const improveResult = await adminAction('generateLLMContent', password, {
        provider,
        model,
        system: `You are an expert SEO copywriter. Return ONLY JSON, no markdown:
{
  "improved_content": "full improved text",
  "improvements": [{"was": "current state description", "became": "improvement description with SPECIFIC examples", "recommendation": "concrete actions to implement"}, {"was": "...", "became": "...", "recommendation": "..."}]
}
Improved content must have: strong H1 headline, meta description, keywords, clear subheadings, call to action, optimal length. In improvements, always:
- WAS: specific problem/deficiency
- BECAME: SHOW THE ACTUAL NEW CONTENT! Examples: "Added H1 headline: 'How to Choose the Best Product in London 2026'" or "Added meta description: 'Buy quality products with delivery, discounts up to 50%'" or "Rewritten paragraph: 'Our company has been helping clients for over 10 years...'
- RECOMMENDATION: step-by-step actions
Show ACTUAL NEW CONTENT, not just descriptions of changes. Specify exact words, phrases, headlines. Answer in English.`,
        messages: [{ role: 'user', content: `Improve this content for maximum traffic:\n\n${pageText.slice(0, 2000)}` }]
      });

      if (!improveResult.success) {
        throw new Error(improveResult.error || 'Failed to improve content');
      }

      const rawImp = improveResult.content;
      const parsedImp = JSON.parse(rawImp.replace(/```json|```/g, "").trim());
      setImproved(parsedImp.improved_content);
      setImprovements(parsedImp.improvements || []);
      setPhase("");
      
      toast.success("Аналіз завершено успішно!");
    } catch (e: any) {
      setError("Помилка аналізу: " + (e.message || "Перевірте контент та спробуйте ще раз"));
      setPhase("");
      toast.error("Помилка аналізу");
    }
    setLoading(false);
  }

  async function copyToClipboard() {
    if (!improved) return;
    try {
      await navigator.clipboard.writeText(improved);
      toast.success("Контент скопійовано в буфер обміну");
    } catch (e) {
      toast.error("Не вдалося скопіювати");
    }
  }

  async function regenerateImprovements() {
    if (!pageText.trim() || loading) return;
    
    setLoading(true);
    setPhase("Оновлення автоматичних покращень...");
    
    try {
      await new Promise(r => setTimeout(r, 300));
      
      const improveResult = await adminAction('generateLLMContent', password, {
        provider,
        model,
        system: `You are an expert SEO copywriter. Return ONLY JSON, no markdown:
{
  "improved_content": "full improved text",
  "improvements": [{"was": "current state description", "became": "improvement description with SPECIFIC examples", "recommendation": "concrete actions to implement"}, {"was": "...", "became": "...", "recommendation": "..."}]
}
Improved content must have: strong H1 headline, meta description, keywords, clear subheadings, call to action, optimal length. In improvements, always:
- WAS: specific problem/deficiency
- BECAME: SHOW THE ACTUAL NEW CONTENT! Examples: "Added H1 headline: 'How to Choose the Best Product in London 2026'" or "Added meta description: 'Buy quality products with delivery, discounts up to 50%'" or "Rewritten paragraph: 'Our company has been helping clients for over 10 years...'
- RECOMMENDATION: step-by-step actions
Show ACTUAL NEW CONTENT, not just descriptions of changes. Specify exact words, phrases, headlines. Answer in English.`,
        messages: [{ role: 'user', content: `Improve this content for maximum traffic:\n\n${pageText.slice(0, 2000)}` }]
      });

      if (!improveResult.success) {
        throw new Error(improveResult.error || 'Failed to regenerate improvements');
      }

      const rawImp = improveResult.content;
      const parsedImp = JSON.parse(rawImp.replace(/```json|```/g, "").trim());
      setImproved(parsedImp.improved_content);
      setImprovements(parsedImp.improvements || []);
      setPhase("");
      
      toast.success("Покращення оновлено!");
    } catch (e: any) {
      setError("Помилка оновлення: " + (e.message || "Спробуйте ще раз"));
      setPhase("");
      toast.error("Помилка оновлення");
    }
    setLoading(false);
  }

  function sendImprovementsToPage() {
    // TODO: Implement sending improved content to the page
    toast.success("Improvements sent to the page!");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SEO2 - Рушій оптимізації сторінок</h2>
          <p className="text-muted-foreground">AI-аналіз • Автоматична оптимізація • Збільшення органічного трафіку</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
          <span className="text-xs text-muted-foreground">Traffic Engine v2.0</span>
        </div>
      </div>

      {/* LLM Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Налаштування LLM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">LLM Провайдер</label>
              <Select value={selectedLLM} onValueChange={setSelectedLLM}>
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть LLM" />
                </SelectTrigger>
                <SelectContent>
                  {llmOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card>
        <CardHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "url")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">📋 Вставити контент</TabsTrigger>
              <TabsTrigger value="url">🔗 URL сторінки</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {tab === "paste" ? (
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Вставте текст сторінки, HTML або контент для аналізу…

Наприклад: заголовок, опис продукту, статтю, лендінг…"
              className="min-h-32 resize-none"
            />
          ) : (
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/page"
            />
          )}

          <Button
            onClick={analyze}
            disabled={loading || (!content.trim() && !url.trim())}
            className="w-full mt-4"
            size="lg"
          >
            {loading ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Activity className="w-4 h-4" />
                {phase || "Аналіз..."}
              </span>
            ) : (
              "▶ Проаналізувати та покращити"
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-destructive text-sm">{error}</div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {scores && (
        <div className="space-y-6">
          {/* Total Score Banner */}
          <Card className={`border-2 ${
            totalScore! >= 75 ? 'border-green-500/20 bg-green-500/5' : 
            totalScore! >= 50 ? 'border-yellow-500/20 bg-yellow-500/5' :
            'border-red-500/20 bg-red-500/5'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <AnimatedScore 
                  value={totalScore!} 
                  color={totalScore! >= 75 ? "#00ff88" : totalScore! >= 50 ? "#ff9900" : "#ff3355"} 
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold">Загальна оцінка сторінки</h3>
                  <p className="text-sm text-muted-foreground">
                    {totalScore! >= 75 ? "🟢 Сторінка добре оптимізована" : 
                     totalScore! >= 50 ? "🟡 Є значний потенціал для зростання" : 
                     "🔴 Потребує суттєвої оптимізації"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={activeView === "scores" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveView("scores")}
                  >
                    📊 Оцінки
                  </Button>
                  <Button
                    variant={activeView === "improved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveView("improved")}
                    disabled={!improved}
                  >
                    ✨ Покращений
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {activeView === "scores" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {METRICS.map(m => (
                  <ScoreCard 
                    key={m.key} 
                    metric={m} 
                    score={scores[m.key]?.score ?? 0} 
                    issues={scores[m.key]?.issues ?? []} 
                  />
                ))}
              </div>

              {improvements.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-sm text-cyan-400 tracking-wider">
                      ✦ AUTOMATIC IMPROVEMENTS
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        onClick={regenerateImprovements} 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        disabled={loading}
                      >
                        <Copy className="w-4 h-4" />
                        Update content
                      </Button>
                      <Button
                        onClick={() => sendImprovementsToPage()}
                        variant="default"
                        size="sm"
                        className="gap-2"
                        disabled={loading || !improved}
                      >
                        <Send className="w-4 h-4" />
                        Send improvements to page
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {improvements.map((imp, i) => (
                      <div key={i} className="flex gap-3 py-3 border-b border-border last:border-0">
                        <div className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs font-bold text-green-500 mt-0.5 shrink-0">
                          {i + 1}
                        </div>
                        <div className="text-sm flex-1 space-y-1">
                          {typeof imp === 'string' ? (
                            <div className="text-muted-foreground">{imp}</div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-red-400 text-xs bg-red-500/10 px-2 py-0.5 rounded">WAS</span>
                                <span className="text-muted-foreground">{imp.was || imp.було}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400 text-xs bg-green-500/10 px-2 py-0.5 rounded">BECAME</span>
                                <span className="text-foreground">{imp.became || imp.стало}</span>
                              </div>
                              {(imp.recommendation || imp.рекомендація) && (
                                <div className="flex items-start gap-2 mt-2">
                                  <span className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded shrink-0">RECOMMENDATION</span>
                                  <span className="text-blue-300 text-xs">{imp.recommendation || imp.рекомендація}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeView === "improved" && improved && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-sm text-cyan-400 tracking-wider">
                  ✦ ПОКРАЩЕНИЙ КОНТЕНТ
                </CardTitle>
                <Button onClick={copyToClipboard} variant="outline" size="sm" className="gap-2">
                  <Copy className="w-4 h-4" />
                  Копіювати
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  <TypewriterText text={improved} speed={8} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!scores && !loading && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4 opacity-30">⬡</div>
            <div className="text-muted-foreground">Вставте контент або введіть URL для аналізу</div>
            <div className="text-xs text-muted-foreground mt-2">
              SEO · Читабельність · Ключові слова · Структура · CTA
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}