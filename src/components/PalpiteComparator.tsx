import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBichoByGroup, getTodayDateString } from '@/lib/bichos';
import { CAPITAL_DRAW_TIME_LABELS, CAPITAL_SECTION_LABEL, isVisibleCapitalDrawTime } from '@/lib/capital';
import { SP_DRAW_TIME_LABELS } from '@/lib/sp';
import { DRAW_TIME_LABELS } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, Search, CheckCircle2, XCircle } from 'lucide-react';

type Lottery = 'RIO' | 'CAPITAL' | 'SP';

interface Row {
  draw_date: string;
  draw_time: string;
  [key: string]: unknown;
}

interface Hit {
  lottery: Lottery;
  date: string;
  timeLabel: string;
  position: number;
  milhar: string;
  group: number;
  bicho: string;
  matched: string[];
}

const LOTTERY_LABELS: Record<Lottery, string> = {
  RIO: 'Rio',
  CAPITAL: CAPITAL_SECTION_LABEL,
  SP: 'SP',
};

function timesForLottery(lottery: Lottery): { value: string; label: string }[] {
  if (lottery === 'RIO') {
    return Object.entries(DRAW_TIME_LABELS).map(([value, label]) => ({ value, label: String(label) }));
  }
  if (lottery === 'CAPITAL') {
    return Object.entries(CAPITAL_DRAW_TIME_LABELS)
      .filter(([value]) => isVisibleCapitalDrawTime(value))
      .map(([value, label]) => ({ value, label: String(label) }));
  }
  return Object.entries(SP_DRAW_TIME_LABELS).map(([value, label]) => ({ value, label: String(label) }));
}

function daysAgoDateString(days: number) {
  const today = getTodayDateString();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() - days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function labelFor(lottery: Lottery, drawTime: string) {
  if (lottery === 'RIO') return `Rio ${DRAW_TIME_LABELS[drawTime] ?? drawTime}`;
  if (lottery === 'CAPITAL') return CAPITAL_DRAW_TIME_LABELS[drawTime] ?? drawTime;
  return `SP ${SP_DRAW_TIME_LABELS[drawTime] ?? drawTime}`;
}

function formatBr(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function PalpiteComparator() {
  const [milhar, setMilhar] = useState('');
  const [centena, setCentena] = useState('');
  const [lottery, setLottery] = useState<'ALL' | Lottery>('ALL');
  const [drawTime, setDrawTime] = useState<string>('ALL');
  const [period, setPeriod] = useState<15 | 30>(15);
  const [searched, setSearched] = useState(false);

  const fromDate = useMemo(() => daysAgoDateString(period - 1), [period]);
  const toDate = getTodayDateString();

  const timeOptions = useMemo(
    () => (lottery === 'ALL' ? [] : timesForLottery(lottery)),
    [lottery],
  );

  const { data, isFetching } = useQuery({
    queryKey: ['palpite_history', fromDate, toDate],
    queryFn: async () => {
      const [rio, capital, sp] = await Promise.all([
        supabase.from('draw_results').select('*').gte('draw_date', fromDate).lte('draw_date', toDate),
        supabase.from('capital_results').select('*').gte('draw_date', fromDate).lte('draw_date', toDate),
        supabase.from('sp_results').select('*').gte('draw_date', fromDate).lte('draw_date', toDate),
      ]);
      if (rio.error) throw rio.error;
      if (capital.error) throw capital.error;
      if (sp.error) throw sp.error;
      return {
        RIO: (rio.data ?? []) as unknown as Row[],
        CAPITAL: ((capital.data ?? []) as unknown as Row[]).filter((r) =>
          isVisibleCapitalDrawTime(String(r.draw_time)),
        ),
        SP: (sp.data ?? []) as unknown as Row[],
      };
    },
    enabled: searched,
  });

  const hasQuery = milhar.length === 4 || centena.length === 3;

  const hits = useMemo<Hit[]>(() => {
    if (!data || !hasQuery) return [];
    const out: Hit[] = [];
    const lotteries: Lottery[] = lottery === 'ALL' ? ['RIO', 'CAPITAL', 'SP'] : [lottery];
    // dezena e grupo são derivados automaticamente do palpite
    const autoDezena = milhar.length === 4 ? milhar.slice(-2) : centena.length === 3 ? centena.slice(-2) : '';

    lotteries.forEach((lot) => {
      data[lot].forEach((row) => {
        if (drawTime !== 'ALL' && String(row.draw_time) !== drawTime) return;
        for (let i = 1; i <= 5; i++) {
          const m = String(row[`prize_${i}_milhar`] ?? '').padStart(4, '0');
          const g = Number(row[`prize_${i}_group`] ?? 0);
          const b = String(row[`prize_${i}_bicho`] ?? '');
          const matched: string[] = [];
          if (milhar.length === 4 && m === milhar) matched.push('Milhar');
          if (centena.length === 3 && m.slice(-3) === centena) matched.push('Centena');
          if (autoDezena && m.slice(-2) === autoDezena) matched.push('Dezena');
          if (matched.length > 0) {
            out.push({
              lottery: lot,
              date: row.draw_date,
              timeLabel: labelFor(lot, String(row.draw_time)),
              position: i,
              milhar: m,
              group: g,
              bicho: b,
              matched,
            });
          }
        }
      });
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.position - b.position));
  }, [data, milhar, centena, hasQuery, lottery, drawTime]);

  const summary = useMemo(() => {
    const active: { type: string; on: boolean }[] = [
      { type: 'Milhar', on: milhar.length === 4 },
      { type: 'Centena', on: centena.length === 3 },
      { type: 'Dezena', on: milhar.length === 4 || centena.length === 3 },
    ];
    return active
      .filter((a) => a.on)
      .map((a) => ({ type: a.type, count: hits.filter((h) => h.matched.includes(a.type)).length }));
  }, [hits, milhar, centena]);

  const onlyDigits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Comparador de Palpites
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Verifique se seu palpite foi premiado nos últimos 30 dias (Rio, CAPITAL & LCAP e SP). A dezena e o
          grupo/bicho são reconhecidos automaticamente pela milhar ou centena.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="milhar">Milhar (4 dígitos)</Label>
            <Input
              id="milhar"
              inputMode="numeric"
              placeholder="0000"
              value={milhar}
              onChange={(e) => setMilhar(onlyDigits(e.target.value, 4))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="centena">Centena (3 dígitos)</Label>
            <Input
              id="centena"
              inputMode="numeric"
              placeholder="000"
              value={centena}
              onChange={(e) => setCentena(onlyDigits(e.target.value, 3))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Loteria</Label>
            <Select
              value={lottery}
              onValueChange={(v) => {
                setLottery(v as 'ALL' | Lottery);
                setDrawTime('ALL');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="ALL">Todas as loterias</SelectItem>
                <SelectItem value="RIO">Rio</SelectItem>
                <SelectItem value="CAPITAL">Capital</SelectItem>
                <SelectItem value="SP">SP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Select value={drawTime} onValueChange={setDrawTime} disabled={lottery === 'ALL'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="ALL">Todos os horários</SelectItem>
                {timeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Período:</span>
          {[15, 30].map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p as 15 | 30)}
            >
              {p} dias
            </Button>
          ))}
          <Button className="ml-auto" disabled={!hasQuery} onClick={() => setSearched(true)}>
            <Search className="h-4 w-4 mr-1.5" />
            Pesquisar
          </Button>
          {(milhar || centena) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMilhar('');
                setCentena('');
                setLottery('ALL');
                setDrawTime('ALL');
                setSearched(false);
              }}
            >
              Limpar
            </Button>
          )}
        </div>

        {searched && (
          <div className="space-y-4">
            {isFetching ? (
              <p className="text-sm text-muted-foreground">Pesquisando no histórico...</p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  Período analisado: {formatBr(fromDate)} até {formatBr(toDate)} ({period} dias corridos)
                  {' · '}
                  {lottery === 'ALL' ? 'Todas as loterias' : LOTTERY_LABELS[lottery]}
                  {lottery !== 'ALL' &&
                    ` · ${drawTime === 'ALL' ? 'Todos os horários' : timeOptions.find((t) => t.value === drawTime)?.label ?? drawTime}`}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {summary.map((s) => (
                    <div
                      key={s.type}
                      className={`rounded-lg border p-3 text-center ${
                        s.count > 0 ? 'border-primary/50 bg-primary/10' : 'border-border/50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 text-sm font-semibold">
                        {s.count > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        {s.type}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.count > 0 ? `Saiu ${s.count}x` : 'Não saiu'}
                      </p>
                    </div>
                  ))}
                </div>

                {hits.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {hits.map((h, idx) => {
                      const bd = getBichoByGroup(h.group);
                      return (
                        <div
                          key={`${h.lottery}-${h.date}-${h.timeLabel}-${h.position}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{h.timeLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBr(h.date)} · {h.position}º prêmio
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display font-bold">{h.milhar}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="mr-1">{bd?.emoji}</span>
                              {String(h.group).padStart(2, '0')} {h.bicho}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 shrink-0">
                            {h.matched.map((m) => (
                              <Badge key={m} variant="secondary" className="text-[10px]">
                                {m}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Seu palpite não foi premiado nos últimos {period} dias.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
