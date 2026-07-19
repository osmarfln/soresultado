import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Radio } from 'lucide-react';
import { DRAW_TIME_LABELS, DRAW_TIMES, getTodayDateString } from '@/lib/bichos';

interface Row {
  draw_time: string;
  source: string | null;
  scraped_at: string | null;
  updated_at: string | null;
  status: string | null;
  prize_1_milhar: string | null;
  prize_1_bicho: string | null;
}

const RIO_ORDER = DRAW_TIMES;

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
  if (s.includes('vejaoresultado')) {
    return <Badge className="bg-blue-600 hover:bg-blue-700">vejaoresultado.com</Badge>;
  }
  if (s.includes('bichoquente')) {
    return <Badge className="bg-amber-600 hover:bg-amber-700">bichoquente.com.br</Badge>;
  }
  if (s.includes('bichocerto')) {
    return <Badge className="bg-purple-600 hover:bg-purple-700">bichocerto.com</Badge>;
  }
  return <Badge variant="secondary">{source}</Badge>;
}

export function ScrapeSourceTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(getTodayDateString());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('draw_results')
      .select('draw_time, source, scraped_at, updated_at, status, prize_1_milhar, prize_1_bicho')
      .eq('draw_date', date);
    setRows((data as Row[]) || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('scrape-source-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draw_results' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const map = new Map(rows.map(r => [r.draw_time, r]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Fonte de dados — Rio de Janeiro
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Qual site foi usado na última atualização de cada horário e quando.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-md border bg-background text-sm"
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Sorteio</th>
                <th className="py-2 pr-4">Fonte</th>
                <th className="py-2 pr-4">Extraído em</th>
                <th className="py-2 pr-4">Atualizado em</th>
                <th className="py-2 pr-4">1º Prêmio</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {RIO_ORDER.map(t => {
                const r = map.get(t);
                const label = DRAW_TIME_LABELS[t as keyof typeof DRAW_TIME_LABELS] || t;
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-semibold">{label}</td>
                    <td className="py-2 pr-4">{sourceBadge(r?.source ?? null)}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmtTime(r?.scraped_at ?? null)}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmtTime(r?.updated_at ?? null)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {r?.prize_1_milhar
                        ? <span><span className="font-bold">{r.prize_1_milhar}</span> <span className="text-muted-foreground">· {r.prize_1_bicho}</span></span>
                        : <span className="text-muted-foreground">aguardando…</span>}
                    </td>
                    <td className="py-2 pr-4">
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
      </CardContent>
    </Card>
  );
}
