import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw, ServerCog, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Lottery = 'rio' | 'sp' | 'capital' | 'federal';

interface RobotLog {
  id: string;
  lottery: Lottery | string;
  source_url: string;
  status: string;
  http_status: number | null;
  duration_ms: number;
  results_found: number;
  inserted_count: number;
  updated_count: number;
  error_message: string | null;
  details: any;
  created_at: string;
}

const ROBOTS: {
  key: Lottery;
  label: string;
  fn: string;
  table: 'draw_results' | 'sp_results' | 'capital_results' | 'federal_results';
  primary: string;
  backup: string;
}[] = [
  { key: 'rio', label: 'RIO DE JANEIRO', fn: 'scrape-results', table: 'draw_results', primary: 'https://www.vejaoresultado.com/', backup: 'https://bichoquente.com.br/' },
  { key: 'capital', label: 'CAPITAL & LCAP', fn: 'scrape-capital', table: 'capital_results', primary: 'https://www.vejaoresultado.com/', backup: 'Leitor alternativo (Firecrawl)' },
  { key: 'sp', label: 'SÃO PAULO', fn: 'scrape-sp', table: 'sp_results', primary: 'https://www.vejaoresultado.com/', backup: 'https://bichocerto.com/' },
  { key: 'federal', label: 'LOTERIA FEDERAL', fn: 'scrape-federal', table: 'federal_results', primary: 'https://www.ojogodobicho.com/deu_no_poste.htm', backup: 'https://bichocerto.com/resultados/fd/loteria-federal/' },
];

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ago(iso: string | null | undefined) {
  if (!iso) return 'nunca';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function statusBadge(status?: string) {
  if (!status) return <Badge variant="outline">sem execução</Badge>;
  if (status === 'success') return <Badge className="bg-emerald-600 hover:bg-emerald-700">sucesso</Badge>;
  if (status === 'no_results') return <Badge className="bg-amber-600 hover:bg-amber-700">sem resultado</Badge>;
  if (status === 'blocked') return <Badge className="bg-orange-600 hover:bg-orange-700">bloqueado</Badge>;
  return <Badge variant="destructive">falha</Badge>;
}

export function RobotStatusTab() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<RobotLog[]>([]);
  const [lastSync, setLastSync] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: logData }, ...syncs] = await Promise.all([
      supabase
        .from('scrape_robot_logs' as any)
        .select('id, lottery, source_url, status, http_status, duration_ms, results_found, inserted_count, updated_count, error_message, details, created_at')
        .order('created_at', { ascending: false })
        .limit(120),
      ...ROBOTS.map(r =>
        supabase.from(r.table as any).select('scraped_at, updated_at').order('updated_at', { ascending: false }).limit(1)
      ),
    ]);

    setLogs(((logData as any[]) || []) as RobotLog[]);
    const map: Record<string, string | null> = {};
    ROBOTS.forEach((r, i) => {
      const row = ((syncs[i] as any)?.data || [])[0];
      map[r.key] = row?.scraped_at || row?.updated_at || null;
    });
    setLastSync(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runRobot = async (fn: string, label: string) => {
    setRunning(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast({ title: `${label} sincronizado`, description: JSON.stringify(data).slice(0, 160) });
    } catch (e: any) {
      toast({ title: `Falha no robô ${label}`, description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setRunning(null);
      await load();
    }
  };

  const runAll = async () => {
    for (const r of ROBOTS) await runRobot(r.fn, r.label);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" /> Status dos robôs de sincronização
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Última sincronização de cada loteria, resultado do último job e o motivo em caso de falha. Os robôs rodam sozinhos a cada 2 minutos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={runAll} disabled={!!running}>
            <Play className="mr-2 h-3.5 w-3.5" /> Sincronizar tudo
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ROBOTS.map(robot => {
            const lotteryLogs = logs.filter(l => l.lottery === robot.key);
            const latest = lotteryLogs[0];
            const failures = lotteryLogs.slice(0, 20).filter(l => l.status !== 'success').length;
            const avg = lotteryLogs.length
              ? Math.round(lotteryLogs.reduce((s, l) => s + (l.duration_ms || 0), 0) / lotteryLogs.length)
              : 0;
            const ok = latest?.status === 'success';

            return (
              <div key={robot.key} className={`rounded-lg border p-4 ${ok ? 'border-emerald-600/40' : latest ? 'border-destructive/40' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold">
                      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {robot.label}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Último resultado gravado: <span className="font-semibold text-foreground">{fmt(lastSync[robot.key])}</span> ({ago(lastSync[robot.key])})
                    </p>
                  </div>
                  {statusBadge(latest?.status)}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Último job</p>
                    <p className="font-semibold tabular-nums">{latest ? fmt(latest.created_at) : '—'}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Tempo médio</p>
                    <p className="flex items-center gap-1 font-semibold tabular-nums"><Clock3 className="h-3 w-3" />{avg ? `${avg} ms` : '—'}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Falhas (20)</p>
                    <p className={`font-semibold tabular-nums ${failures ? 'text-destructive' : ''}`}>{failures}</p>
                  </div>
                </div>

                {latest?.error_message && (
                  <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    Motivo da falha: {latest.error_message}{latest.http_status ? ` (HTTP ${latest.http_status})` : ''}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <a href={robot.primary} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      Fonte principal <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-muted-foreground">Auxílio: {robot.backup}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => runRobot(robot.fn, robot.label)} disabled={!!running}>
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${running === robot.fn ? 'animate-spin' : ''}`} /> Sincronizar agora
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">Histórico de execuções</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data e hora</th>
                  <th className="px-3 py-2">Loteria</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tempo</th>
                  <th className="px-3 py-2">Resultados</th>
                  <th className="px-3 py-2">Motivo / erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 40).map(log => (
                  <tr key={log.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">{fmt(log.created_at)}</td>
                    <td className="px-3 py-2 text-xs font-semibold uppercase">{log.lottery}</td>
                    <td className="px-3 py-2">{statusBadge(log.status)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">{log.duration_ms} ms</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{log.results_found} encontrados · {log.inserted_count} novos · {log.updated_count} atualizados</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-destructive">{log.error_message || '—'}</td>
                  </tr>
                ))}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhuma execução registrada ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
