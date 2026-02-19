import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, History, ExternalLink, Clock, RefreshCw, StopCircle, CheckCircle2, AlertCircle, Terminal, Play, Trash2 } from 'lucide-react';

type Provider = 'ollama' | 'lmstudio';
type ConnectionStatus = 'unknown' | 'checking' | 'connected' | 'error';

export function LocalRetellPanel({ password }: { password: string }) {
  const queryClient = useQueryClient();
  const [isDevHost, setIsDevHost] = useState(false);
  
  // Settings
  const [provider, setProvider] = useState<Provider>('ollama');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [lmStudioUrl, setLmStudioUrl] = useState('http://localhost:1234/v1');
  
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [onlyWithoutRetell, setOnlyWithoutRetell] = useState<boolean>(true);
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ total: 0, done: 0, success: 0, failed: 0, skipped: 0 });
  const [lastError, setLastError] = useState<string>('');
  const [status, setStatus] = useState<ConnectionStatus>('unknown');
  const [connError, setConnError] = useState<string>('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const abortRef = useRef<boolean>(false);
  
  // Realtime logs and tests
  const [logs, setLogs] = useState<{ id: number; msg: string; type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
  const [testResults, setTestResults] = useState<{ model: string; time: number; status: 'ok' | 'error' }[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [lastPushedLinks, setLastPushedLinks] = useState<{ id: string; title: string; url: string }[]>([]);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    setLogs(prev => [{ id: Date.now(), msg, type }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    try {
      const host = window?.location?.hostname || '';
      setIsDevHost(host === 'localhost' || host === '127.0.0.1');
    } catch {
      setIsDevHost(false);
    }
  }, []);

  const { data: countries = [] } = useQuery({
    queryKey: ['local-dev-countries'],
    queryFn: async () => {
      const { data } = await supabase.from('news_countries').select('id, code, name, flag').eq('is_active', true).order('sort_order');
      return data || [];
    },
  });

  const { data: stagingStats, refetch: refetchStats } = useQuery({
    queryKey: ['local-staged-stats'],
    queryFn: async () => {
      const { data: all, error } = await (supabase as any)
        .from('ollama_retell_staging')
        .select('id, pushed', { count: 'exact' });
      if (error) return { total: 0, pushed: 0, unpushed: 0 };
      const rows: any[] = all || [];
      const total = rows.length;
      const pushedCount = rows.filter((r: any) => r.pushed).length;
      return { total, pushed: pushedCount, unpushed: total - pushedCount };
    },
    refetchInterval: 30_000,
  });

  const { data: recentRetells = [], refetch: refetchRecent } = useQuery({
    queryKey: ['local-staged-recent'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ollama_retell_staging')
        .select(`
          id, news_id, model, pushed, created_at, 
          news_rss_items(id, title, slug, source_url, country_id, news_countries(code))
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return (data || []) as any[];
    },
    refetchInterval: 10_000,
  });

  const { data: newsForDate = [] } = useQuery({
    queryKey: ['local-dev-news-for-date', selectedCountry, selectedDate],
    queryFn: async () => {
      if (!selectedCountry || !selectedDate) return [];
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      const { data } = await supabase
        .from('news_rss_items')
        .select('id, title, content, content_en, original_content, fetched_at, country_id')
        .eq('country_id', selectedCountry)
        .gte('fetched_at', startOfDay)
        .lte('fetched_at', endOfDay)
        .order('fetched_at', { ascending: true });
      return data || [];
    },
    enabled: !!selectedCountry && !!selectedDate,
  });

  const checkTable = useCallback(async () => {
    try {
      const { error } = await (supabase as any).from('ollama_retell_staging').select('id').limit(1);
      setTableReady(!error);
    } catch {
      setTableReady(false);
    }
  }, []);

  useEffect(() => {
    if (isDevHost) checkTable();
  }, [isDevHost, checkTable]);

  const fetchModels = useCallback(async () => {
    setIsFetchingModels(true);
    setStatus('checking');
    setConnError('');
    try {
      if (provider === 'ollama') {
        const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : (json?.models || []);
        const names = rawList.map((t: any) => typeof t === 'string' ? t : (t.name || t.model || t.tag || JSON.stringify(t)));
        setModels(names);
        setStatus(names.length > 0 ? 'connected' : 'error');
        if (names.length > 0) setSelectedModel(prev => prev || names[0]);
        return names;
      } else {
        // LM Studio (OpenAI compat)
        const res = await fetch(`${lmStudioUrl}/models`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const names = (json?.data || []).map((m: any) => m.id);
        setModels(names);
        setStatus(names.length > 0 ? 'connected' : 'error');
        if (names.length > 0) setSelectedModel(prev => prev || names[0]);
        return names;
      }
    } catch (e: any) {
      setConnError(e?.message || String(e));
      setStatus('error');
      setModels([]);
      return [];
    } finally {
      setIsFetchingModels(false);
    }
  }, [provider, ollamaUrl, lmStudioUrl]);

  useEffect(() => {
    if (isDevHost) fetchModels();
  }, [isDevHost, provider]); // Re-fetch only on provider change or host init

  const setupTable = async () => {
    setIsSettingUp(true);
    try {
      const res = await callEdgeFunction('admin', { action: 'ensureOllamaTable', password, data: {} }) as any;
      if (res?.success) {
        setTableReady(true);
        setLastError('');
        refetchStats();
        refetchRecent();
      } else {
        setLastError('Помилка створення таблиці: ' + (res?.error || 'невідомо'));
      }
    } catch (e: any) {
      setLastError('Помилка створення таблиці: ' + (e?.message || String(e)));
    } finally {
      setIsSettingUp(false);
    }
  };

  const start = async () => {
    if (!selectedModel) return alert('Оберіть модель');
    if (!selectedCountry || !selectedDate) return alert('Оберіть країну та дату');

    abortRef.current = false;
    setIsRunning(true);
    setLastError('');
    addLog(`Запуск пакетного переказу для ${selectedCountry} (${selectedDate}). Підготовка черги...`);

    let list = onlyWithoutRetell
      ? newsForDate.filter(n => !(n.content_en && n.content_en.length > 100))
      : [...newsForDate];

    if (batchSize > 0) list = list.slice(0, batchSize);
    setProgress({ total: list.length, done: 0, success: 0, failed: 0, skipped: 0 });
    
    if (list.length === 0) {
      addLog('Немає новин для обробки! Спробуйте іншу дату або зніміть фільтр "тільки без переказу".', 'warn');
      setIsRunning(false);
      return;
    }

    addLog(`Починаємо обробку ${list.length} новин за допомогою ${selectedModel}...`, 'info');

    const systemPrompt = `You are a professional journalist. Return JSON with keys: content, key_points (array), themes (array), keywords (array). First paragraph must answer WHO, WHAT, WHERE, WHEN, WHY. Do NOT invent facts.`;

    for (let i = 0; i < list.length; i++) {
      if (abortRef.current) {
        addLog('Обробку перервано користувачем', 'warn');
        break;
      }
      const item = list[i];
      try {
        addLog(`[${i+1}/${list.length}] Обробка: ${item.title?.slice(0, 50)}...`, 'info');
        const userPrompt = `Title: ${item.title}\n\nOriginal content: ${item.original_content || item.content || ''}\n\nRespond with JSON only.`;
        let text = '';
        const startTime = Date.now();

        if (provider === 'ollama') {
          const resp = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false })
          });
          if (!resp.ok) throw new Error(`Ollama Error ${resp.status}: ${await resp.text()}`);
          const body = await resp.json();
          text = body?.message?.content || JSON.stringify(body);
        } else {
          // LM Studio / OpenAI compat
          const resp = await fetch(`${lmStudioUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false })
          });
          if (!resp.ok) throw new Error(`LM Studio Error ${resp.status}: ${await resp.text()}`);
          const body = await resp.json();
          text = body?.choices?.[0]?.message?.content || JSON.stringify(body);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        let parsed: any = null;
        try {
          const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
          parsed = JSON.parse((jsonMatch[1] || text).trim());
        } catch {
          parsed = { content: text, key_points: [], themes: [], keywords: [] };
        }

        const { error: saveErr } = await (supabase as any)
          .from('ollama_retell_staging')
          .upsert({
            news_id: item.id,
            model: `${provider}/${selectedModel}`,
            language: 'en',
            content: parsed.content || text,
            key_points: parsed.key_points || [],
            themes: parsed.themes || [],
            keywords: parsed.keywords || [],
            pushed: false,
          }, { onConflict: 'news_id,model' });

        if (saveErr) throw saveErr;
        addLog(`Успішно за ${duration}с: ${item.title?.slice(0, 40)}`, 'success');
        setProgress(p => ({ ...p, done: p.done + 1, success: p.success + 1 }));
        await new Promise(r => setTimeout(r, 250));
      } catch (err: any) {
        addLog(`Помилка: ${item.title?.slice(0, 40)}: ${err.message}`, 'error');
        setLastError(`${item.title?.slice(0, 40)}: ${err.message}`);
        setProgress(p => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
      }
    }
    setIsRunning(false);
    addLog(`Завершено! Успішно: ${progress.success}, Помилок: ${progress.failed}`, 'info');
    refetchStats();
    refetchRecent();
  };

  const runAutoTest = async () => {
    if (models.length === 0) return alert('Оберіть провайдера та оновіть список моделей');
    if (!selectedCountry || !selectedDate) return alert('Оберіть країну та дату для тестового матеріалу');
    if (newsForDate.length === 0) return alert('Немає новин для проведення тесту на цю дату');

    setIsTesting(true);
    setTestResults([]);
    abortRef.current = false;
    addLog('--- Початок автотесту моделей ---', 'info');

    const testItem = newsForDate[0];
    const systemPrompt = "Summarize this in one sentence.";
    const userPrompt = `Title: ${testItem.title}\nContent: ${testItem.content?.slice(0, 300)}`;

    for (const model of models) {
      if (abortRef.current) break;
      addLog(`Тестування моделі: ${model}...`, 'info');
      const startTime = performance.now();
      try {
        let text = '';
        if (provider === 'ollama') {
          const resp = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false })
          });
          if (!resp.ok) throw new Error('ERR');
          const body = await resp.json();
          text = body?.message?.content || '';
        } else {
          const resp = await fetch(`${lmStudioUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false })
          });
          if (!resp.ok) throw new Error('ERR');
          const body = await resp.json();
          text = body?.choices?.[0]?.message?.content || '';
        }
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        setTestResults(prev => [...prev, { model, time: duration, status: 'ok' }]);
        addLog(`Модель ${model}: ${duration.toFixed(2)}с - SUCCESS`, 'success');
      } catch {
        setTestResults(prev => [...prev, { model, time: 0, status: 'error' }]);
        addLog(`Модель ${model}: ERROR`, 'error');
      }
    }
    setIsTesting(false);
  };

  const stop = () => {
    abortRef.current = true;
    setIsRunning(false);
  };

  const clearStaging = async () => {
    if (!confirm('Ви впевнені, що хочете очистити ВСІ перекази зі стейджингу?')) return;
    
    try {
      addLog('Очищення таблиці стейджингу...', 'warn');
      const { error } = await (supabase as any).from('ollama_retell_staging').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      
      addLog('Стейджинг успішно очищено', 'success');
      refetchStats();
      refetchRecent();
    } catch (e: any) {
      addLog(`Помилка очищення: ${e.message}`, 'error');
    }
  };

  const pushToLive = async () => {
    try {
      addLog('Запуск процесу синхронізації зі стейджингу в Live...', 'info');
      const res = await callEdgeFunction('admin', { action: 'pushOllamaStagedToLive', password, data: {} }) as any;
      if (res?.success) {
        addLog(`Синхронізація успішна: ${res.pushed} новин перенесено в Live`, 'success');
        refetchStats();
        refetchRecent();
        
        // Fetch recently pushed for the links section
        const { data } = await (supabase as any)
          .from('ollama_retell_staging')
          .select('news_id, news_rss_items(id, title, slug, news_countries(code))')
          .eq('pushed', true)
          .order('id', { ascending: false })
          .limit(5);
        
        if (data) {
          const links = data.map((d: any) => ({
            id: d.news_rss_items?.id,
            title: d.news_rss_items?.title,
            url: `https://hronovs.news/news/${d.news_rss_items?.news_countries?.code}/${d.news_rss_items?.slug}`
          }));
          setLastPushedLinks(links);
        }

        alert(`Опубліковано: оброблено=${res.processed}, добавлено=${res.pushed}, пропущено=${res.skipped}`);
      } else {
        addLog(`Помилка публікації: ${res?.error || 'unknown'}`, 'error');
        alert('Помилка: ' + (res?.error || 'unknown'));
      }
    } catch (e: any) { 
      addLog(`Критична помилка публікації: ${e.message}`, 'error');
      alert('Помилка публікації'); 
    }
  };

  if (!isDevHost) return <div className="p-8 text-center text-muted-foreground">Доступно лише на localhost</div>;

  return (
    <Card className="max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Локальний переказ (Dev)</span>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-green-500' : status === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-normal uppercase tracking-wider">{status}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-lg bg-muted/30 p-4 border border-border">
          <RadioGroup value={provider} onValueChange={(v: any) => setProvider(v)} className="flex gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ollama" id="ollama" />
              <Label htmlFor="ollama" className="cursor-pointer font-bold">Ollama</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="lmstudio" id="lmstudio" />
              <Label htmlFor="lmstudio" className="cursor-pointer font-bold">LM Studio</Label>
            </div>
          </RadioGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Endpoint URL</Label>
              <Input 
                value={provider === 'ollama' ? ollamaUrl : lmStudioUrl} 
                onChange={e => provider === 'ollama' ? setOllamaUrl(e.target.value) : setLmStudioUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Обрана модель</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={models.length === 0}>
                <SelectTrigger className="font-mono text-xs h-9">
                  <SelectValue placeholder={status === 'checking' ? 'Завантаження...' : 'Оберіть модель'} />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {connError && <div className="text-[10px] text-red-500 font-mono mt-1 italic">{connError}</div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Країна</Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
              <SelectContent>{countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Дата</Label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Розмір пакета</Label>
            <Select value={String(batchSize)} onValueChange={v => setBatchSize(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 50, 100, 500, 1000].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={fetchModels} disabled={isFetchingModels}>Оновити моделі</Button>
          </div>
        </div>

        {tableReady === false && (
          <div className="flex items-center justify-between rounded bg-orange-500/10 p-3 border border-orange-500/20 text-sm text-orange-200">
            <span>Потрібна ініціалізація бази даних</span>
            <Button size="sm" variant="outline" onClick={setupTable} disabled={isSettingUp}>{isSettingUp ? '...' : 'Створити таблицю'}</Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={start} disabled={isRunning || isTesting || !selectedModel || !selectedCountry || !selectedDate || tableReady === false} className="flex-1 min-w-[200px]">
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? 'Запущено...' : 'Запустити переказ → staging'}
          </Button>
          <Button variant="outline" onClick={runAutoTest} disabled={isRunning || isTesting || !selectedModel || !selectedCountry || !selectedDate} className="flex-1 min-w-[200px]">
             <Zap className={`w-4 h-4 mr-2 text-yellow-500 ${isTesting ? 'animate-pulse' : ''}`} />
             {isTesting ? 'Тестування...' : 'Автотест моделей'}
          </Button>
          <Button variant="destructive" onClick={stop} disabled={!isRunning && !isTesting}>
            <StopCircle className="w-4 h-4 mr-1" />
            Стоп
          </Button>
          <Button variant="secondary" onClick={pushToLive} className="relative shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" />
            Публікація в Live
            {stagingStats && stagingStats.unpushed > 0 && (
              <span className="ml-2 bg-yellow-400 text-yellow-950 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {stagingStats.unpushed}
              </span>
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearStaging} 
            title="Очистити стейджинг"
            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Real-time Logs */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            Лог подій (Real-time)
            <div className={`h-1.5 w-1.5 rounded-full bg-blue-500 ${(isRunning || isTesting) ? 'animate-pulse' : ''}`} />
          </Label>
          <div className="h-44 overflow-y-auto rounded-md border border-border/50 bg-black/40 p-3 font-mono text-[11px] flex flex-col-reverse gap-1.5">
            {logs.length === 0 && <div className="text-muted-foreground italic opacity-30 text-center py-12">Очікування команд...</div>}
            {logs.map(log => (
              <div key={log.id} className={`border-l-2 pl-2 flex items-start gap-2 ${
                log.type === 'error' ? 'text-red-400 border-red-500 bg-red-500/5' : 
                log.type === 'success' ? 'text-green-400 border-green-500 bg-green-500/5' : 
                log.type === 'warn' ? 'text-orange-400 border-orange-500 bg-orange-500/5' : 
                'text-blue-300 border-blue-500 bg-blue-500/5'
              }`}>
                <span className="opacity-40 text-[9px] shrink-0 pt-0.5">[{new Date(log.id).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                <span>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-test results table */}
        {(testResults.length > 0 || isTesting) && (
          <div className="space-y-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-in fade-in slide-in-from-top-4">
            <h4 className="text-sm font-bold flex items-center gap-2 text-blue-400">
              <Clock className="w-4 h-4" /> Результати бенчмарку моделей
            </h4>
            <div className="overflow-hidden rounded-md border border-border/50 bg-background/50">
              <table className="w-full text-[11px] font-mono">
                <thead className="bg-muted/80 border-b border-border">
                  <tr>
                    <th className="p-2 text-left">Модель</th>
                    <th className="p-2 text-center w-24">Статус</th>
                    <th className="p-2 text-right w-24">Час (с)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {testResults.map((res, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2 truncate max-w-[200px] flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${res.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {res.model}
                      </td>
                      <td className={`p-2 text-center`}>
                        {res.status === 'ok' ? 
                          <span className="text-green-500 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span> : 
                          <span className="text-red-500 flex items-center justify-center gap-1 font-bold"><AlertCircle className="w-3 h-3" /> ERR</span>
                        }
                      </td>
                      <td className="p-2 text-right font-bold text-blue-400">
                        {res.status === 'ok' ? res.time.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                  {isTesting && (
                    <tr className="animate-pulse bg-blue-500/5">
                      <td className="p-2" colSpan={3}>Обробка наступної моделі...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Last Pushed Links section */}
        {lastPushedLinks.length > 0 && (
          <div className="space-y-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 animate-in zoom-in-95 duration-500">
            <h4 className="text-sm font-bold flex items-center gap-2 text-green-500">
              <CheckCircle2 className="w-4 h-4" /> Нещодавно опубліковані в Live
            </h4>
            <div className="grid gap-2">
              {lastPushedLinks.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded bg-green-500/5 text-xs border border-green-500/20 group hover:bg-green-500/10 transition-all">
                  <div className="truncate font-medium flex items-center gap-2">
                    <span className="text-[10px] text-green-500/50">#{idx+1}</span>
                    {link.title}
                  </div>
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-shrink-0 px-3 py-1 rounded-full bg-green-500 text-green-950 font-bold hover:bg-green-400 flex items-center gap-1 transition-all"
                  >
                    Переглянути <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic opacity-60">Ці новини вже доступні користувачам на продакшені</p>
          </div>
        )}

        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="flex items-center gap-2">
                Обробка: {progress.done}/{progress.total}
                {progress.done > 0 && <span className="opacity-50">({Math.round((progress.done/progress.total)*100)}%)</span>}
              </span>
              <div className="flex gap-4">
                <span className="text-green-400 flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10"><CheckCircle2 className="w-3 h-3" /> {progress.success}</span>
                <span className="text-red-400 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10"><AlertCircle className="w-3 h-3" /> {progress.failed}</span>
              </div>
            </div>
            <Progress value={(progress.done / progress.total) * 100} className="h-2.5" />
          </div>
        )}
        {lastError && <div className="text-[10px] bg-red-500/10 border border-red-500/20 p-2 rounded font-mono text-red-300 break-all">{lastError}</div>}

        <div className="space-y-4 pt-4 border-t border-border">
          {recentRetells.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex justify-between items-center">
                <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Останні результати (Staging)</span>
                {stagingStats && <span>Всього в базі: {stagingStats.total}</span>}
              </div>
              <div className="space-y-2">
                {recentRetells.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-2.5 rounded bg-muted/20 border border-border text-xs group hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium group-hover:text-blue-400 transition-colors">{r.news_rss_items?.title || r.news_id}</div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                        <span className="font-mono text-[9px] px-1 bg-border/50 rounded flex items-center gap-1">
                           <Zap className="w-2.5 h-2.5 text-blue-400" /> {r.model}
                        </span>
                        {r.news_rss_items?.source_url && (
                          <a href={r.news_rss_items.source_url} target="_blank" className="text-muted-foreground hover:text-blue-300 hover:underline flex items-center gap-1">
                            Джерело <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold border ${
                        r.pushed 
                        ? 'bg-green-500/5 text-green-400 border-green-500/30' 
                        : 'bg-yellow-500/5 text-yellow-500 border-yellow-500/30'
                      }`}>
                        {r.pushed ? 'Опубліковано' : 'В черзі'}
                      </span>
                      <span className="text-[8px] opacity-40 font-mono flex items-center gap-1">
                         <Clock className="w-2.5 h-2.5" /> {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Remove the unused scaleInCenter string and component tail 


