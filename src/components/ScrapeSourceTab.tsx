import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Radio } from 'lucide-react';
import { DRAW_TIME_LABELS, DRAW_TIMES, getTodayDateString } from '@/lib/bichos';
import { SP_DRAW_TIMES, SP_DRAW_TIME_LABELS } from '@/lib/sp';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS } from '@/lib/capital';

interface Row {
  draw_time?: string;
  source: string | null;
  scraped_at: string | null;
  updated_at: string | null;
  status: string | null;
  prize_1_milhar: string | null;
  prize_1_bicho: string | null;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function sourceBadge(source: string | null) {
  if (!source) return <Badge variant="outline">—</Badge>;
  const s = source.toLowerCase();
  if (s.includes('vejaoresultado')) return <Badge className="bg-blue-600 hover:bg-blue-700">vejaoresultado.com</Badge>;
  if (s.includes('bichoquente'))    return <Badge className="bg-amber-600 hover:bg-amber-700">bichoquente.com.br</Badge>;
  if (s.includes('bichocerto'))     return <Badge className="bg-purple-600 hover:bg-purple-700">bichocerto.com</Badge>;
  if (s.includes('megabicho'))      return <Badge className="bg-pink-600 hover:bg-pink-700">megabicho.com</Badge>;
  if (s.includes('federal_results'))return <Badge className="bg-yellow-600 hover:bg-yellow-700">federal fallback</Badge>;
  return <Badge variant="secondary">{source}</Badge>;
}

interface SectionProps {
  title: string;
  color: string;
  table: 'draw_results' | 'sp_results' | 'capital_results' | 'federal_results';
  order: readonly string[];
  labels: Record<string, string>;
  date: string;
  isFederal?: boolean;
}

function LotterySection({ title, color, table, order, labels, date, isFederal }: SectionProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const cols = 'source, scraped_at, updated_at, status, prize_1_milhar, prize_1_bicho' + (isFederal ? '' : ', draw_time');
    const { data } = await supabase.from(table as any).select(cols).eq('draw_date', date);
    setRows((data as any) || []);
    setLoading(false);
  }, [table, date, isFederal]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`src-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, table]);

  const map = new Map(rows.map(r => [r.draw_time || 'FEDERAL', r]));
  const list = isFederal ? ['FEDERAL'] : order;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-bold uppercase tracking-wide ${color}`}>{title}</h3>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="py-2 px-3">Sorteio</th>
              <th className="py-2 px-3">Fonte</th>
              <th className="py-2 px-3">Extraído em</th>
              <th className="py-2 px-3">Atualizado em</th>
              <th className="py-2 px-3">1º Prêmio</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => {
              const r = map.get(t);
              const label = isFederal ? 'Loteria Federal' : (labels[t] || t);
              return (
                <tr key={t} className="border-t last:border-b-0">
                  <td className="py-2 px-3 font-semibold">{label}</td>
                  <td className="py-2 px-3">{sourceBadge(r?.source ?? null)}</td>
                  <td className="py-2 px-3 tabular-nums text-xs">{fmtTime(r?.scraped_at ?? null)}</td>
                  <td className="py-2 px-3 tabular-nums text-xs">{fmtTime(r?.updated_at ?? null)}</td>
                  <td className="py-2 px-3 tabular-nums">
                    {r?.prize_1_milhar
                      ? <span><span className="font-bold">{r.prize_1_milhar}</span> <span className="text-muted-foreground">· {r.prize_1_bicho}</span></span>
                      : <span className="text-muted-foreground">aguardando…</span>}
                  </td>
                  <td className="py-2 px-3">
                    {r
                      ? <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'}>{r.status}</Badge>
                      : <Badge variant="outline">pendente</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScrapeSourceTab() {
  const [date, setDate] = useState(getTodayDateString());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Fonte de dados & Sincronização
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Qual site foi usado na última atualização de cada loteria e o horário exato em que o resultado entrou no banco. Atualiza em tempo real.
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 rounded-md border bg-background text-sm"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <LotterySection title="Rio de Janeiro" color="text-blue-500" table="draw_results" order={DRAW_TIMES} labels={DRAW_TIME_LABELS as any} date={date} />
        <LotterySection title="Capital" color="text-emerald-500" table="capital_results" order={CAPITAL_DRAW_TIMES} labels={CAPITAL_DRAW_TIME_LABELS} date={date} />
        <LotterySection title="São Paulo" color="text-orange-500" table="sp_results" order={SP_DRAW_TIMES} labels={SP_DRAW_TIME_LABELS} date={date} />
        <LotterySection title="Federal" color="text-yellow-500" table="federal_results" order={[]} labels={{}} date={date} isFederal />
      </CardContent>
    </Card>
  );
}
