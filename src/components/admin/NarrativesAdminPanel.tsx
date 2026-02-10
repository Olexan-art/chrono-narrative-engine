import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, BrainCircuit, Edit, Check, X, ExternalLink, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const SENTIMENTS = ['positive', 'negative', 'neutral', 'mixed'] as const;
type Sentiment = typeof SENTIMENTS[number];

const SENTIMENT_MAP: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  positive: { icon: '🟢', label: 'Positive', color: 'hsl(142, 71%, 45%)', bg: 'bg-emerald-500/15' },
  negative: { icon: '🔴', label: 'Negative', color: 'hsl(0, 84%, 60%)', bg: 'bg-red-500/15' },
  neutral: { icon: '⚪', label: 'Neutral', color: 'hsl(220, 9%, 46%)', bg: 'bg-muted' },
  mixed: { icon: '🟡', label: 'Mixed', color: 'hsl(45, 93%, 47%)', bg: 'bg-amber-500/15' },
};

interface NarrativeRow {
  id: string;
  entity_id: string;
  year_month: string;
  language: string;
  news_count: number;
  is_regenerated: boolean;
  sentiment: string;
  summary: string;
  entity_name: string;
  entity_name_en: string | null;
  entity_slug: string | null;
  entity_type: string;
  created_at: string;
}

export function NarrativesAdminPanel() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSentiment, setEditSentiment] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch all narratives
  const { data: narratives = [], isLoading } = useQuery({
    queryKey: ['admin-narratives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_analyses')
        .select(`
          id, entity_id, year_month, language, news_count, is_regenerated, analysis, created_at,
          entity:wiki_entities(name, name_en, slug, entity_type)
        `)
        .order('year_month', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        entity_id: row.entity_id,
        year_month: row.year_month,
        language: row.language,
        news_count: row.news_count,
        is_regenerated: row.is_regenerated,
        sentiment: row.analysis?.sentiment || 'neutral',
        summary: row.analysis?.narrative_summary || '',
        entity_name: row.entity?.name || '—',
        entity_name_en: row.entity?.name_en,
        entity_slug: row.entity?.slug,
        entity_type: row.entity?.entity_type || 'unknown',
        created_at: row.created_at,
      })) as NarrativeRow[];
    },
  });

  // Update sentiment mutation
  const updateSentiment = useMutation({
    mutationFn: async ({ id, sentiment }: { id: string; sentiment: string }) => {
      // First get current analysis
      const { data: current, error: fetchError } = await supabase
        .from('narrative_analyses')
        .select('analysis')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const analysis = (current.analysis as any) || {};
      analysis.sentiment = sentiment;

      const { error } = await supabase
        .from('narrative_analyses')
        .update({ analysis })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Сентимент оновлено');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-narratives'] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Charts data
  const chartsByMonth = useMemo(() => {
    const months: Record<string, { month: string; total: number; positive: number; negative: number; neutral: number; mixed: number }> = {};
    narratives.forEach(n => {
      if (!months[n.year_month]) {
        months[n.year_month] = { month: n.year_month, total: 0, positive: 0, negative: 0, neutral: 0, mixed: 0 };
      }
      months[n.year_month].total += 1;
      const s = n.sentiment as Sentiment;
      if (s in months[n.year_month]) {
        (months[n.year_month] as any)[s] += 1;
      }
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [narratives]);

  const topEntities = useMemo(() => {
    const counts: Record<string, { name: string; slug: string | null; count: number; type: string }> = {};
    narratives.forEach(n => {
      if (!counts[n.entity_id]) {
        counts[n.entity_id] = { name: n.entity_name_en || n.entity_name, slug: n.entity_slug, count: 0, type: n.entity_type };
      }
      counts[n.entity_id].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [narratives]);

  const sentimentTotals = useMemo(() => {
    const totals = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    narratives.forEach(n => {
      const s = n.sentiment as Sentiment;
      if (s in totals) totals[s] += 1;
    });
    return Object.entries(totals).map(([name, value]) => ({
      name: SENTIMENT_MAP[name]?.label || name,
      value,
      fill: SENTIMENT_MAP[name]?.color || 'hsl(var(--muted))',
    }));
  }, [narratives]);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{narratives.length}</div>
            <p className="text-xs text-muted-foreground">Всього наративів</p>
          </CardContent>
        </Card>
        {SENTIMENTS.map(s => (
          <Card key={s}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold flex items-center gap-1">
                <span>{SENTIMENT_MAP[s].icon}</span>
                {narratives.filter(n => n.sentiment === s).length}
              </div>
              <p className="text-xs text-muted-foreground">{SENTIMENT_MAP[s].label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Narratives by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Наративи по місяцях
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sentiments by month stacked */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="w-4 h-4 text-primary" />
              Сентименти по місяцях
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="positive" stackId="a" fill={SENTIMENT_MAP.positive.color} name="Positive" />
                  <Bar dataKey="negative" stackId="a" fill={SENTIMENT_MAP.negative.color} name="Negative" />
                  <Bar dataKey="mixed" stackId="a" fill={SENTIMENT_MAP.mixed.color} name="Mixed" />
                  <Bar dataKey="neutral" stackId="a" fill={SENTIMENT_MAP.neutral.color} name="Neutral" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top entities */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Топ сутностей за кількістю наративів
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEntities} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Наративів" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BrainCircuit className="w-5 h-5" />
            Список наративів
          </CardTitle>
          <CardDescription>Редагуйте сентимент натиснувши на іконку редагування</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сутність</TableHead>
                  <TableHead>Місяць</TableHead>
                  <TableHead>Мова</TableHead>
                  <TableHead className="text-center">Новин</TableHead>
                  <TableHead>Сентимент</TableHead>
                  <TableHead>Саммарі</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {narratives.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Link 
                        to={`/wiki/${n.entity_slug || n.entity_id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {n.entity_name_en || n.entity_name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{n.entity_type}</p>
                    </TableCell>
                    <TableCell className="text-sm">{n.year_month}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{n.language}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{n.news_count}</TableCell>
                    <TableCell>
                      {editingId === n.id ? (
                        <div className="flex items-center gap-1">
                          {SENTIMENTS.map(s => (
                            <button
                              key={s}
                              onClick={() => setEditSentiment(s)}
                              className={`text-lg p-0.5 rounded ${editSentiment === s ? 'ring-2 ring-primary' : 'opacity-50 hover:opacity-100'}`}
                              title={SENTIMENT_MAP[s].label}
                            >
                              {SENTIMENT_MAP[s].icon}
                            </button>
                          ))}
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => updateSentiment.mutate({ id: n.id, sentiment: editSentiment })}
                            disabled={updateSentiment.isPending}
                          >
                            <Check className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${SENTIMENT_MAP[n.sentiment]?.bg || ''}`}>
                          <span>{SENTIMENT_MAP[n.sentiment]?.icon || '⚪'}</span>
                          <span>{SENTIMENT_MAP[n.sentiment]?.label || n.sentiment}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.summary}</p>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditingId(n.id); setEditSentiment(n.sentiment); }}
                        title="Змінити сентимент"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
