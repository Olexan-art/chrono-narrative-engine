import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Trash2, SearchCheck, Shield, RefreshCw, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Must match PURGE_SECRET constant in cloudflare-worker.js
const PURGE_SECRET = 'bnn-cache-purge-key-2026';

// Mirror of TTL_RULES in cloudflare-worker.js — edit both together
const TTL_RULES = [
  { label: 'Головна',   pattern: /^\/$|^\/home$/,          ttl: 6  * 3600, paths: ['/'] },
  { label: 'Новини',    pattern: /^\/news(\/|$)/,           ttl: 1  * 3600, paths: ['/news', '/news/ua', '/news/us'] },
  { label: 'Статті',    pattern: /^\/read\//,               ttl: 1  * 3600, paths: [] },
  { label: 'Дати',      pattern: /^\/date\//,               ttl: 2  * 3600, paths: [] },
  { label: 'Wiki',      pattern: /^\/wiki(\/|$)/,           ttl: 24 * 3600, paths: ['/wiki'] },
  { label: 'Теми',      pattern: /^\/topics(\/|$)/,         ttl: 6  * 3600, paths: ['/topics'] },
  { label: 'Глава',     pattern: /^\/chapter(s)?(\/|$)/,    ttl: 12 * 3600, paths: ['/chapters'] },
  { label: 'Том',       pattern: /^\/volume(s)?(\/|$)/,     ttl: 12 * 3600, paths: ['/volumes'] },
  { label: 'Календар',  pattern: /^\/calendar(\/|$)/,       ttl: 6  * 3600, paths: ['/calendar'] },
  { label: 'Sitemap',   pattern: /^\/sitemap/,              ttl: 12 * 3600, paths: ['/sitemap'] },
  { label: 'Решта',     pattern: null,                      ttl: 1  * 3600, paths: [] },
] as const;

function formatTTL(seconds: number): string {
  if (seconds >= 3600) return `${seconds / 3600}г`;
  if (seconds >= 60)   return `${Math.round(seconds / 60)}хв`;
  return `${seconds}с`;
}

function getTTLColor(ttl: number): string {
  if (ttl >= 24 * 3600) return 'text-green-400';
  if (ttl >= 6  * 3600) return 'text-blue-400';
  if (ttl >= 2  * 3600) return 'text-amber-400';
  return 'text-orange-400';
}

interface CacheStatusResult {
  cached: boolean;
  stale?: boolean;
  path: string;
  ttl?: string;
  ttlLeft?: number;     // seconds until expiry
  expiresAt?: string;   // ISO date string
  htmlSize?: number;    // bytes
  cacheControl?: string;
  ssrSource?: string;
  source?: string;
  error?: string;
}

export function CacheSettingsPanel() {
  const { toast } = useToast();
  const [checkPath,    setCheckPath]    = useState('/');
  const [statusResult, setStatusResult] = useState<CacheStatusResult | null>(null);
  const [purgePath,    setPurgePath]    = useState('');
  const [loading,      setLoading]      = useState<Record<string, boolean>>({});

  const origin = window.location.origin;

  // ── Check cache status for a path ───────────────────────────────────
  async function checkStatus() {
    setLoading(l => ({ ...l, check: true }));
    setStatusResult(null);
    try {
      const res  = await fetch(`${origin}/api/cache-status?path=${encodeURIComponent(checkPath)}`);
      const data = await res.json() as CacheStatusResult;
      setStatusResult(data);
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося перевірити статус кешу', variant: 'destructive' });
    } finally {
      setLoading(l => ({ ...l, check: false }));
    }
  }

  // ── Purge single path ────────────────────────────────────────────────
  async function purgeSingle() {
    if (!purgePath.trim()) return;
    setLoading(l => ({ ...l, purge: true }));
    try {
      const res  = await fetch(
        `${origin}/api/cache-purge?secret=${PURGE_SECRET}&path=${encodeURIComponent(purgePath.trim())}`,
        { method: 'POST' }
      );
      const data = await res.json() as { ok: boolean; deleted?: boolean };
      if (data.ok) {
        toast({
          title: data.deleted ? '✅ Видалено з кешу' : 'ℹ️ Не знайдено в кеші',
          description: purgePath.trim(),
        });
        setPurgePath('');
      }
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося очистити кеш', variant: 'destructive' });
    } finally {
      setLoading(l => ({ ...l, purge: false }));
    }
  }

  // ── Purge all known paths ────────────────────────────────────────────
  async function purgeAll() {
    setLoading(l => ({ ...l, purgeAll: true }));
    try {
      const res  = await fetch(
        `${origin}/api/cache-purge?secret=${PURGE_SECRET}&path=all`,
        { method: 'POST' }
      );
      const data = await res.json() as { ok: boolean; purged?: { path: string; deleted: boolean }[] };
      if (data.ok) {
        const count = data.purged?.filter(r => r.deleted).length ?? 0;
        toast({ title: `✅ Очищено ${count} сторінок`, description: 'CF edge cache очищено' });
      }
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося очистити весь кеш', variant: 'destructive' });
    } finally {
      setLoading(l => ({ ...l, purgeAll: false }));
    }
  }

  return (
    <div className="space-y-6">

      {/* Header info */}
      <Card className="cosmic-card border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-400">
            <Zap className="w-5 h-5" />
            Cloudflare ISR — Cache-First SSR
          </CardTitle>
          <CardDescription>
            Кожна сторінка генерується SSR один раз і зберігається в таблиці <code>cached_pages</code> (Supabase).
            CF Worker читає звідти при кожному BOT-запиті. CF CDN CACHE не використовується (<code>no-store</code>),
            щоб уникнути некерованого застарілого кешу. Кеш оновлюється після TTL або ручного purge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>CF Edge Cache (per-node)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Shield className="w-4 h-4 text-green-400" />
              <span>Боти + юзери = однаковий HTML</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Fallback → Netlify SPA shell</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TTL rules table */}
      <Card className="cosmic-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono">TTL per-path правила</CardTitle>
          <CardDescription>Перший відповідний паттерн виграє (порядок зверху вниз)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-mono text-xs text-muted-foreground">Секція</th>
                  <th className="text-left px-4 py-2 font-mono text-xs text-muted-foreground">Паттерн URL</th>
                  <th className="text-right px-4 py-2 font-mono text-xs text-muted-foreground">TTL</th>
                  <th className="text-right px-4 py-2 font-mono text-xs text-muted-foreground">Секунди</th>
                </tr>
              </thead>
              <tbody>
                {TTL_RULES.map((rule, i) => (
                  <tr key={i} className="border-b last:border-0 border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium">{rule.label}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {rule.pattern ? rule.pattern.toString() : '*(будь-який інший)*'}
                    </td>
                    <td className={`px-4 py-2 text-right font-bold font-mono ${getTTLColor(rule.ttl)}`}>
                      {formatTTL(rule.ttl)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground font-mono">
                      {rule.ttl}с
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Щоб змінити TTL — оновіть <code className="bg-muted px-1 rounded">TTL_RULES</code> в{' '}
            <code className="bg-muted px-1 rounded">cloudflare-worker.js</code> і задеплойте worker.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Check status */}
        <Card className="cosmic-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SearchCheck className="w-4 h-4 text-cyan-400" />
              Перевірити статус кешу
            </CardTitle>
            <CardDescription>Перевіряє таблицю <code>cached_pages</code> в Supabase — реальний ISR кеш</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="/news/ua"
                value={checkPath}
                onChange={e => setCheckPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkStatus()}
                className="font-mono text-sm"
              />
              <Button onClick={checkStatus} disabled={loading.check} variant="outline" size="sm">
                {loading.check ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Перевірити'}
              </Button>
            </div>

            {statusResult && (
              <div className="p-3 rounded-lg border bg-muted/20 space-y-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  {!statusResult.cached && (
                    <Badge variant="secondary">❌ Не в кеші</Badge>
                  )}
                  {statusResult.cached && !statusResult.stale && (
                    <Badge variant="default">✅ Свіжий кеш</Badge>
                  )}
                  {statusResult.cached && statusResult.stale && (
                    <Badge variant="outline" className="border-amber-500 text-amber-400">⏰ Застарілий (stale)</Badge>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">{statusResult.path}</span>
                </div>
                {statusResult.error && (
                  <p className="text-xs text-red-400 font-mono">Помилка: {statusResult.error}</p>
                )}
                {statusResult.cached && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                    {statusResult.ttlLeft !== undefined && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Залишилось: <span className={statusResult.stale ? 'text-red-400' : 'text-amber-400'}>
                          {statusResult.stale ? 'прострочено' : `${statusResult.ttlLeft}с`}
                        </span>
                      </p>
                    )}
                    {statusResult.htmlSize !== undefined && (
                      <p className="text-xs text-muted-foreground font-mono">
                        HTML: <span className="text-green-400">{(statusResult.htmlSize / 1024).toFixed(1)} KB</span>
                      </p>
                    )}
                    {statusResult.expiresAt && (
                      <p className="text-xs text-muted-foreground font-mono col-span-2">
                        Expires: <span className="text-blue-400">{new Date(statusResult.expiresAt).toLocaleString('uk-UA')}</span>
                      </p>
                    )}
                    {statusResult.source && (
                      <p className="text-xs text-muted-foreground font-mono col-span-2">
                        Джерело: <span className="text-purple-400">{statusResult.source}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purge cache */}
        <Card className="cosmic-card border-orange-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4 text-orange-400" />
              Очистити кеш
            </CardTitle>
            <CardDescription>Видалити конкретну сторінку або весь кеш з CF edge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="/wiki/ukraine"
                value={purgePath}
                onChange={e => setPurgePath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && purgeSingle()}
                className="font-mono text-sm"
              />
              <Button
                onClick={purgeSingle}
                disabled={loading.purge || !purgePath.trim()}
                variant="outline"
                size="sm"
                className="border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
              >
                {loading.purge ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Purge'}
              </Button>
            </div>

            <div className="border-t border-border pt-3">
              <Button
                onClick={purgeAll}
                disabled={loading.purgeAll}
                variant="outline"
                size="sm"
                className="w-full border-red-500/30 hover:bg-red-500/10 text-red-400 gap-2"
              >
                {loading.purgeAll
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
                Очистити всі відомі сторінки
              </Button>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Очищає: /, /news, /wiki, /topics, /calendar, /chapters, /volumes, /sitemap
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Note about CF node-based caching */}
      <Card className="cosmic-card border-yellow-500/20">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-yellow-400 font-medium">⚠️ Важливо:</span>{' '}
            Cloudflare Cache API зберігає копію на кожному edge-вузлі окремо.
            &ldquo;Перевірити статус&rdquo; та &ldquo;Purge&rdquo; діє тільки на вузол, через який пройшов ваш запит.
            Для глобального purge використовуйте Cloudflare Dashboard → Caching → Purge Cache.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
