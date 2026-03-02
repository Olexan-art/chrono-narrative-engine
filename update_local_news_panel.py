import re
import os

filepath = 'src/components/admin/LocalNewsPanel.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Rename component
content = content.replace('export function LocalRetellPanel({ password }: { password: string }) {', 'export function LocalNewsPanel({ password }: { password: string }) {')

# Add missing state variables at the beginning of the component
state_inj = """
  // Source Scoring generation
  const [selectedNewsForScoring, setSelectedNewsForScoring] = useState<string>('');
  const [isGeneratingScoring, setIsGeneratingScoring] = useState(false);
  const [onlyWithoutScoringFilter, setOnlyWithoutScoringFilter] = useState<boolean>(true);
  const [generateAllWithoutScoring, setGenerateAllWithoutScoring] = useState<boolean>(false);
  const [scoringProgress, setScoringProgress] = useState({ total: 0, done: 0, success: 0, failed: 0 });

  // Staged scoring stats
  const { data: scoringStagingStats, refetch: refetchScoringStats } = useQuery({
    queryKey: ['local-staged-scoring-stats'],
    queryFn: async () => {
      const { data: all, error } = await (supabase as any)
        .from('ollama_scoring_staging')
        .select('id, pushed', { count: 'exact' });
      if (error) return { total: 0, pushed: 0, unpushed: 0 };
      const rows: any[] = all || [];
      const total = rows.length;
      const pushedCount = rows.filter((r: any) => r.pushed).length;
      return { total, pushed: pushedCount, unpushed: total - pushedCount };
    },
    refetchInterval: 30_000,
  });
"""
content = content.replace('// Deep Analysis generation', state_inj + '\n  // Deep Analysis generation')

# Fix newsForDate query
new_news_query = """const { data, error } = await supabase
        .from('news_rss_items')
        .select('id, title, url, content_en, fetched_at, country_id')
        .eq('country_id', selectedCountry)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay)
        .order('fetched_at', { ascending: true });"""

content = content.replace(
    """const { data, error } = await supabase
        .from('news_rss_items')
        .select('id, title, content_en, fetched_at, country_id')
        .eq('country_id', selectedCountry)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay)
        .order('fetched_at', { ascending: true });""",
    new_news_query
)

# Fix has_analysis checking to also check source_scoring
check_scoring_q = """
      const { data: analysisCheck } = await supabase
        .from('news_rss_items')
        .select('id, news_analysis, source_scoring')
        .in('id', ids);

      const hasAnalysisSet = new Set((analysisCheck || []).filter((a: any) => a.news_analysis).map((a: any) => a.id));
      const hasScoringSet = new Set((analysisCheck || []).filter((a: any) => a.source_scoring).map((a: any) => a.id));

      console.log('[LocalNewsPanel] News with analysis:', hasAnalysisSet.size, 'with scoring:', hasScoringSet.size);

      return (data || []).map((n: any) => ({
        ...n,
        has_analysis: hasAnalysisSet.has(n.id),
        has_scoring: hasScoringSet.has(n.id)
      }));"""

content = re.sub(
    r"""const { data: analysisCheck } = await supabase\s*\.from\('news_rss_items'\)\s*\.select\('id'\)\s*\.in\('id', ids\)\s*\.not\('news_analysis', 'is', null\);\s*const hasAnalysisSet = new Set\(\(analysisCheck \|\| \[\]\)\.map\(\(a: any\) => a\.id\)\);\s*console\.log\('\[LocalRetellPanel\] News with analysis:', hasAnalysisSet\.size\);\s*return \(data \|\| \[\]\)\.map\(\(n: any\) => \(\{\s*\.\.\.n,\s*has_analysis: hasAnalysisSet\.has\(n\.id\)\s*\}\)\);""",
    check_scoring_q,
    content
)
content = content.replace('[LocalRetellPanel]', '[LocalNewsPanel]')

# Let's add the generateSourceScoring function right before generateDeepAnalysis
generate_scoring_func = """
  const generateSourceScoring = async () => {
    if (!selectedModel) {
      alert('Оберіть модель');
      return;
    }

    let newsToProcess: any[] = [];
    if (generateAllWithoutScoring) {
      newsToProcess = newsForDate.filter((n: any) => !n.has_scoring);
      if (newsToProcess.length === 0) {
        alert('Немає новин без Source Scoring');
        return;
      }
    } else {
      if (!selectedNewsForScoring) {
        alert('Оберіть новину для Source Scoring');
        return;
      }
      const singleNews = newsForDate.find((n: any) => n.id === selectedNewsForScoring);
      if (singleNews) newsToProcess = [singleNews];
    }

    if (newsToProcess.length === 0) {
      alert('Немає новин для обробки');
      return;
    }

    setIsGeneratingScoring(true);
    addLog(`Запуск генерації Source Scoring для ${newsToProcess.length} новин...`, 'info');
    let successCount = 0;
    let failCount = 0;
    setScoringProgress({ total: newsToProcess.length, done: 0, success: 0, failed: 0 });

    try {
      const counts = { success: 0, fail: 0 };
      const concurrency = 2;
      const queue = [...newsToProcess];
      let currentIndex = 0;

      const processScoringItem = async (newsItem: any, i: number) => {
        try {
          if (abortRef.current) return;
          addLog(`[${i + 1}/${newsToProcess.length}] Генерація Scoring: ${newsItem.title?.slice(0, 60)}...`, 'info');

          const systemPrompt = `Ти — News Scoring Engine. Оціни новину (англійською мовою).
Завдання: (1) витягни ключові claims (цифри/імена/дати/події), (2) підтверди кожен claim мінімум 2 незалежними джерелами або 1 первинним, (3) порахуй скоринг 0–100.

Скоринг:
- reliability: якість джерела + узгодженість + конкретика.
- importance: масштаб/вплив (суспільство/ринок/закони/великі суми/відомі особи).
- volatility_risk (менше = краще): ризик “плаваючих” даних/методології.
overall = round(reliability*0.45 + importance*0.30 + corroboration*0.15 + scope_clarity*0.10)
Пороги decision: <70 Low, 70–79 Normal, 80–89 Highlight, 90–94 Highlight+, 95+ Push.
Статус: Verified / Partially Verified / Unverified. Confidence ≈ reliability.

Вивід СТРОГО 1 частина (Тільки JSON відділений маркерами).
Використовуй такий формат відповіді:
---JSON_START---
{
 "url":"", "title":"", "claimed_source":"", "published_at":null,
 "verification_status":"", "confidence":0,
 "scores":{"overall":0,"reliability":0,"importance":0,"corroboration":0,"scope_clarity":0,"volatility_risk":0},
 "key_claims":[{"claim":"","verdict":"confirmed|partial|unclear|contradicted","notes":""}],
 "evidence":[{"source_name":"","url":"","strength":"primary|high|medium|low"}],
 "caveats":[]
}
---JSON_END---`;

          const { data: fullNews } = await supabase.from('news_rss_items').select('content, original_content, description, url').eq('id', newsItem.id).single();
          const textToAnalyze = fullNews ? (fullNews.original_content || fullNews.content || fullNews.description || '') : '';
          const userPrompt = `URL: ${newsItem.url || fullNews?.url}\\nTitle: ${newsItem.title}\\n\\nContent to evaluate:\\n${textToAnalyze.substring(0, 5000)}`;

          const startTime = Date.now();
          let responseText = '';

          if (provider === 'ollama') {
            const resp = await fetch(`${ollamaUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                stream: false
              })
            });
            if (!resp.ok) throw new Error(`Ollama Error ${resp.status}: ${await resp.text()}`);
            const body = await resp.json();
            responseText = body?.message?.content || JSON.stringify(body);
          } else {
            const resp = await fetch(`${lmStudioUrl}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                stream: false,
                temperature: 0.3
              })
            });
            if (!resp.ok) throw new Error(`LM Studio Error ${resp.status}: ${await resp.text()}`);
            const body = await resp.json();
            responseText = body?.choices?.[0]?.message?.content || JSON.stringify(body);
          }

          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          
          let jsonResult: any = {};
          
          const jsonMatch = responseText.match(/---JSON_START---([\\s\\S]*?)---JSON_END---/);
          if (jsonMatch && jsonMatch[1]) {
            jsonResult = JSON.parse(jsonMatch[1].trim());
          } else {
            const fallbackMatch = responseText.match(/```(?:json)?\\n([\\s\\S]*?)\\n```/);
            if (fallbackMatch && fallbackMatch[1]) {
              jsonResult = JSON.parse(fallbackMatch[1].trim());
            } else {
              jsonResult = JSON.parse(responseText.trim());
            }
          }

          if (!jsonResult || !jsonResult.scores) throw new Error('Invalid JSON structure returned by LLM');

          // Save to staging table
          const res = await callEdgeFunction('admin', {
            action: 'saveOllamaScoringStaged',
            password,
            data: {
              newsId: newsItem.id,
              model: `${provider}/${selectedModel}`,
              scoringData: jsonResult
            }
          }) as any;

          if (!res?.success) {
            throw new Error(`Staging Error: ${res?.error}`);
          }

          addLog(`✓ [${i + 1}/${newsToProcess.length}] Scoring збережено за ${duration}с: ${newsItem.title?.slice(0, 40)}`, 'success');
          counts.success++;
          setScoringProgress(p => ({ ...p, done: p.done + 1, success: counts.success }));
          
          refetchScoringStats();

        } catch (itemErr: any) {
          const itemErrorMsg = itemErr?.message || String(itemErr);
          addLog(`✗ Помилка: ${newsItem.title?.slice(0, 40)}: ${itemErrorMsg}`, 'error');
          counts.fail++;
          setScoringProgress(p => ({ ...p, done: p.done + 1, failed: counts.fail }));
        }
      };

      const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
        while (queue.length > 0 && !abortRef.current) {
          const item = queue.shift();
          const i = currentIndex++;
          if (item) {
            await processScoringItem(item, i);
            await new Promise(r => setTimeout(r, 500));
          }
        }
      });

      await Promise.all(workers);

      if (abortRef.current) {
        addLog('Source Scoring перервано користувачем', 'warn');
      }

      addLog(`Завершено! Успішно: ${counts.success}, Помилок: ${counts.fail}`, counts.success > 0 ? 'success' : 'warn');

    } catch (err: any) {
      addLog(`Критична помилка: ${err?.message || String(err)}`, 'error');
    } finally {
      setIsGeneratingScoring(false);
    }
  };
"""

content = content.replace('const generateDeepAnalysis = async () => {', generate_scoring_func + '\n\n  const generateDeepAnalysis = async () => {')

# Add UI for Source Scoring right after Deep Analysis
scoring_ui = """
        {/* Source Scoring section */}
        <div className="space-y-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-blue-300">Генерація Source Scoring (локально в стейджинг)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Оцінює новину за надійністю, важливістю та підтвердженістю, зберігає у стейджинг таблицю
          </p>

          <div className="flex flex-wrap gap-3 items-center p-3 rounded bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filterNoScoring"
                checked={onlyWithoutScoringFilter}
                onChange={(e) => setOnlyWithoutScoringFilter(e.target.checked)}
                className="w-4 h-4 rounded border-blue-500/50 bg-background text-blue-500 focus:ring-blue-500"
              />
              <Label htmlFor="filterNoScoring" className="text-xs cursor-pointer font-medium">
                Показувати тільки без Source Scoring
              </Label>
            </div>
            <div className="h-4 w-px bg-blue-500/30" />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="generateAllModeScoring"
                checked={generateAllWithoutScoring}
                onChange={(e) => {
                  setGenerateAllWithoutScoring(e.target.checked);
                  if (e.target.checked) setSelectedNewsForScoring('');
                }}
                className="w-4 h-4 rounded border-blue-500/50 bg-background text-blue-500 focus:ring-blue-500"
              />
              <Label htmlFor="generateAllModeScoring" className="text-xs cursor-pointer font-bold text-blue-300">
                🚀 Генерувати для ВСІХ без скорингу
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">
                {generateAllWithoutScoring ? 'Режим масової генерації скорингу' : 'Новина для скорингу'}
              </Label>
              {generateAllWithoutScoring ? (
                <div className="p-3 rounded bg-blue-500/5 border border-blue-500/30 text-xs">
                  <div className="font-bold text-blue-300 mb-1">
                    📊 Буде оброблено: {newsForDate.filter((n: any) => !n.has_scoring).length} новин
                  </div>
                </div>
              ) : (
                <Select
                  value={selectedNewsForScoring}
                  onValueChange={setSelectedNewsForScoring}
                  disabled={newsLoading || !selectedCountry || !selectedDate || newsForDate.length === 0}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder={
                      newsLoading ? "Завантаження..." :
                        newsForDate.length === 0 ? "Спочатку оберіть країну та дату" : "Оберіть новину..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {newsForDate
                      .filter((news: any) => !onlyWithoutScoringFilter || !news.has_scoring)
                      .map((news: any) => (
                        <SelectItem key={news.id} value={news.id} className="text-xs">
                          <div className="flex items-center gap-2 max-w-md">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${news.has_scoring ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <div className="truncate">
                              {news.title}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-end">
              <Button
                className={`w-full gap-2 ${generateAllWithoutScoring ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={generateSourceScoring}
                disabled={newsLoading || (!generateAllWithoutScoring && !selectedNewsForScoring) || !selectedModel || isGeneratingScoring || isRunning || isGeneratingAnalysis || isTesting}
              >
                {isGeneratingScoring ? <><Loader2 className="w-4 h-4 animate-spin" />Генерація...</> : <><Zap className="w-4 h-4" />{generateAllWithoutScoring ? 'Generate ALL' : 'Generate Scoring'}</>}
              </Button>
            </div>
          </div>
          
          {isGeneratingScoring && scoringProgress.total > 0 && (
            <div className="space-y-2 animate-in fade-in">
              <div className="flex justify-between text-xs font-mono">
                <span>Обробка {scoringProgress.done}/{scoringProgress.total}</span>
                <div className="flex gap-4">
                  <span className="text-green-400"><CheckCircle2 className="inline w-3 h-3" /> {scoringProgress.success}</span>
                  <span className="text-red-400"><AlertCircle className="inline w-3 h-3" /> {scoringProgress.failed}</span>
                </div>
              </div>
              <Progress value={(scoringProgress.done / scoringProgress.total) * 100} className="h-2.5 bg-blue-500/20" />
            </div>
          )}
        </div>
"""

content = content.replace('{/* Deep Analysis section */}', scoring_ui + '\n\n        {/* Deep Analysis section */}')

# Now for buttons related to scoring: "Push Scoring to Live" and "Clear Scoring Staging" 
# we should add an action button or separate section like we have for Retell Staging
push_scoring_buttons = """
  const pushScoringToLive = async () => {
    try {
      addLog('Запуск публікації Source Scoring зі стейджингу в Live...', 'info');
      const res = await callEdgeFunction('admin', { action: 'pushOllamaScoringStagedToLive', password, data: {} }) as any;
      if (res?.success) {
        addLog(`Source Scoring: ${res.pushed} новин перенесено в Live. (Пропущено: ${res.skipped})`, 'success');
        refetchScoringStats();
        alert(`Source Scoring опубліковано: оброблено=${res.processed}, добавлено=${res.pushed}, пропущено=${res.skipped}`);
      } else {
        addLog(`Помилка публікації Scoring: ${res?.error || 'unknown'}`, 'error');
      }
    } catch (e: any) {
      addLog(`Критична помилка публікації: ${e.message}`, 'error');
    }
  };

  const clearScoringStaging = async () => {
    if (!confirm('Ви впевнені, що хочете очистити ВСІ скоринги зі стейджингу?')) return;
    try {
      const { error } = await (supabase as any).from('ollama_scoring_staging').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      addLog('Стейджинг Source Scoring очищено', 'success');
      refetchScoringStats();
    } catch (e: any) {
      addLog(`Помилка очищення scoring: ${e.message}`, 'error');
    }
  };
"""

content = content.replace('const generateDeepAnalysis', push_scoring_buttons + '\n  const generateDeepAnalysis')

# Button UI logic for Scoring operations next to others
scoring_action_buttons = """
          <Button variant="secondary" onClick={pushScoringToLive} className="relative shrink-0 border-blue-500/50">
            <RefreshCw className="w-4 h-4 mr-2 text-blue-400" />
            Scoring в Live
            {scoringStagingStats && scoringStagingStats.unpushed > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {scoringStagingStats.unpushed}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearScoringStaging}
            title="Очистити стейджинг Scoring"
            className="text-blue-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
"""
content = content.replace(
    '          <Button variant="outline" onClick={runAutoTest} disabled={isRunning || isTesting || !selectedModel || !selectedCountry || !selectedDate} className="flex-1 min-w-[200px]">' + '\n',
    scoring_action_buttons + '\n' + '          <Button variant="outline" onClick={runAutoTest} disabled={isRunning || isTesting || !selectedModel || !selectedCountry || !selectedDate} className="flex-1 min-w-[200px]">' + '\n'
)

# Replace table ready to run scoring table creation as well, or we can just rely on the API action 'ensureOllamaTable' to ensure both or add a new action
setup_table_func = """
    try {
      addLog('Ініціалізація таблиць...', 'info');
      await callEdgeFunction('admin', { action: 'ensureOllamaTable', password, data: {} });
      await callEdgeFunction('admin', { action: 'ensureOllamaScoringTable', password, data: {} });
      setTableReady(true);
      setLastError('');
      refetchStats();
      refetchRecent();
      refetchScoringStats();
    } catch (e: any) {
"""
content = re.sub(
    r"""try \{\s*const res = await callEdgeFunction\('admin', \{ action: 'ensureOllamaTable', password, data: \{\} \}\) as any;\s*if \(res\?\.success\) \{\s*setTableReady\(true\);\s*setLastError\(''\);\s*refetchStats\(\);\s*refetchRecent\(\);\s*\}\s*else \{\s*setLastError\('Помилка створення таблиці: '\s*\+\s*\(res\?\.error \|\| 'невідомо'\)\);\s*\}\s*\}\s*catch \(e: any\) \{""",
    setup_table_func,
    content
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
