import { useState, useMemo } from 'react';
import logoImg from '@/assets/logo.png';
import { useRecentResults } from '@/hooks/useResults';
import { useRecentCapitalResults } from '@/hooks/useCapitalResults';
import { useRecentFederalResults } from '@/hooks/useFederalResults';
import type { CapitalResult } from '@/hooks/useCapitalResults';
import type { FederalResult } from '@/hooks/useFederalResults';
import { BICHOS, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Trophy, BarChart3, TrendingUp, TrendingDown, Calendar, ArrowLeft, PieChart, Activity, MapPin, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import type { DrawResult } from '@/hooks/useResults';

type AnyResult = DrawResult | CapitalResult | FederalResult;

const CHART_COLORS = [
  'hsl(152, 60%, 45%)', 'hsl(43, 90%, 55%)', 'hsl(200, 70%, 50%)',
  'hsl(340, 65%, 55%)', 'hsl(270, 55%, 55%)', 'hsl(30, 80%, 50%)',
  'hsl(170, 60%, 40%)', 'hsl(0, 65%, 55%)', 'hsl(220, 60%, 55%)',
  'hsl(90, 55%, 45%)', 'hsl(310, 50%, 50%)', 'hsl(50, 70%, 50%)',
  'hsl(180, 50%, 45%)', 'hsl(15, 75%, 50%)', 'hsl(240, 50%, 55%)',
  'hsl(130, 50%, 40%)', 'hsl(350, 60%, 50%)', 'hsl(60, 65%, 45%)',
  'hsl(190, 55%, 50%)', 'hsl(280, 45%, 55%)', 'hsl(100, 50%, 40%)',
  'hsl(20, 70%, 50%)', 'hsl(210, 55%, 50%)', 'hsl(330, 55%, 50%)',
  'hsl(150, 45%, 45%)',
];

type PrizeFilter = 'all' | '1' | '2' | '3' | '4' | '5';

function getGroupFromResult(r: AnyResult, prize: number): number {
  return r[`prize_${prize}_group` as keyof typeof r] as number;
}

function computeFrequency(results: AnyResult[], prizeFilter: PrizeFilter) {
  const freq = new Map<number, number>();
  BICHOS.forEach(b => freq.set(b.group, 0));

  results?.forEach(r => {
    const prizes = prizeFilter === 'all'
      ? [1, 2, 3, 4, 5]
      : [parseInt(prizeFilter)];
    prizes.forEach(p => {
      const group = getGroupFromResult(r, p);
      freq.set(group, (freq.get(group) || 0) + 1);
    });
  });

  return BICHOS.map(b => ({
    group: b.group,
    name: b.name,
    emoji: b.emoji,
    count: freq.get(b.group) || 0,
  })).sort((a, b) => b.count - a.count);
}

function computeTrend(results: AnyResult[]) {
  if (!results || results.length === 0) return [];

  // Sort results chronologically by date + draw_time
  const sorted = [...results].sort((a, b) => {
    const dc = a.draw_date.localeCompare(b.draw_date);
    if (dc !== 0) return dc;
    const aTime = 'draw_time' in a ? String(a.draw_time) : '';
    const bTime = 'draw_time' in b ? String(b.draw_time) : '';
    return aTime.localeCompare(bTime);
  });

  // Track top 5 most frequent overall
  const overallFreq = computeFrequency(results, 'all');
  const top5 = overallFreq.slice(0, 5);

  // Build cumulative "index" like a stock chart
  const cumulative = new Map<number, number>();
  top5.forEach(t => cumulative.set(t.group, 0));

  return sorted.map((r, idx) => {
    // For each draw, update cumulative counts
    for (let p = 1; p <= 5; p++) {
      const g = getGroupFromResult(r, p);
      if (cumulative.has(g)) {
        cumulative.set(g, (cumulative.get(g) || 0) + 1);
      }
    }

    const label = `${r.draw_date.slice(5)} ${'draw_time' in r ? String(r.draw_time).replace(/_/g, ' ') : 'FED'}`;
    const entry: Record<string, any> = { date: idx % 3 === 0 ? label : '' , fullDate: label };

    top5.forEach(t => {
      entry[t.name] = cumulative.get(t.group) || 0;
    });

    return entry;
  });
}

function computeGroupStrength(results: AnyResult[]) {
  // Weighted: 1st prize = 5pts, 2nd = 4pts, 3rd = 3pts, 4th = 2pts, 5th = 1pt
  const strength = new Map<number, number>();
  BICHOS.forEach(b => strength.set(b.group, 0));

  results?.forEach(r => {
    for (let p = 1; p <= 5; p++) {
      const group = getGroupFromResult(r, p);
      const weight = 6 - p; // 5,4,3,2,1
      strength.set(group, (strength.get(group) || 0) + weight);
    }
  });

  return BICHOS.map(b => ({
    group: b.group,
    name: b.name,
    emoji: b.emoji,
    strength: strength.get(b.group) || 0,
  })).sort((a, b) => b.strength - a.strength);
}

function computeHotCold(results: AnyResult[]) {
  if (!results || results.length < 10) return { hot: [], cold: [] };

  // Compare last 7 days vs overall average
  const dates = [...new Set(results.map(r => r.draw_date))].sort();
  const recentDates = new Set(dates.slice(-3));

  const recentFreq = new Map<number, number>();
  const totalFreq = new Map<number, number>();
  BICHOS.forEach(b => { recentFreq.set(b.group, 0); totalFreq.set(b.group, 0); });

  let recentCount = 0, totalCount = 0;
  results.forEach(r => {
    const isRecent = recentDates.has(r.draw_date);
    for (let p = 1; p <= 5; p++) {
      const g = getGroupFromResult(r, p);
      totalFreq.set(g, (totalFreq.get(g) || 0) + 1);
      totalCount++;
      if (isRecent) {
        recentFreq.set(g, (recentFreq.get(g) || 0) + 1);
        recentCount++;
      }
    }
  });

  const data = BICHOS.map(b => {
    const recentRate = recentCount > 0 ? (recentFreq.get(b.group) || 0) / recentCount : 0;
    const avgRate = totalCount > 0 ? (totalFreq.get(b.group) || 0) / totalCount : 0;
    const change = avgRate > 0 ? ((recentRate - avgRate) / avgRate) * 100 : 0;
    return { ...b, recentRate, avgRate, change, recentCount: recentFreq.get(b.group) || 0 };
  });

  return {
    hot: data.filter(d => d.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
    cold: data.filter(d => d.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
  };
}

function getMilharFromResult(r: AnyResult, prize: number): string {
  return (r[`prize_${prize}_milhar` as keyof typeof r] as string) || '';
}

function computeDelayed(results: AnyResult[]) {
  if (!results || results.length === 0) return [];

  const sorted = [...results].sort((a, b) => {
    const dc = a.draw_date.localeCompare(b.draw_date);
    if (dc !== 0) return dc;
    const aTime = 'draw_time' in a ? String(a.draw_time) : '';
    const bTime = 'draw_time' in b ? String(b.draw_time) : '';
    return aTime.localeCompare(bTime);
  });

  const lastSeen = new Map<number, number>();
  BICHOS.forEach(b => lastSeen.set(b.group, -1));

  sorted.forEach((r, idx) => {
    for (let p = 1; p <= 5; p++) {
      const g = getGroupFromResult(r, p);
      lastSeen.set(g, idx);
    }
  });

  const total = sorted.length;
  return BICHOS.map(b => {
    const last = lastSeen.get(b.group) ?? -1;
    const delay = last === -1 ? total : total - 1 - last;
    return { ...b, delay };
  }).sort((a, b) => b.delay - a.delay);
}

function computeDelayedDezenas(results: AnyResult[]) {
  if (!results || results.length === 0) return [];

  const sorted = [...results].sort((a, b) => {
    const dc = a.draw_date.localeCompare(b.draw_date);
    if (dc !== 0) return dc;
    const aTime = 'draw_time' in a ? String(a.draw_time) : '';
    const bTime = 'draw_time' in b ? String(b.draw_time) : '';
    return aTime.localeCompare(bTime);
  });

  // Track last seen draw index for each dezena (00-99)
  const lastSeen = new Map<string, number>();
  const totalCount = new Map<string, number>();
  for (let d = 0; d <= 99; d++) {
    const dz = String(d).padStart(2, '0');
    lastSeen.set(dz, -1);
    totalCount.set(dz, 0);
  }

  sorted.forEach((r, idx) => {
    const seenInThisDraw = new Set<string>();
    for (let p = 1; p <= 5; p++) {
      const milhar = getMilharFromResult(r, p);
      if (!milhar || milhar.length < 2) continue;
      const dz = milhar.slice(-2);
      if (!seenInThisDraw.has(dz)) {
        seenInThisDraw.add(dz);
        totalCount.set(dz, (totalCount.get(dz) || 0) + 1);
      }
      lastSeen.set(dz, idx);
    }
  });

  const total = sorted.length;
  const dezenas: { dezena: string; group: number; bicho: typeof BICHOS[number]; delay: number; appearances: number }[] = [];

  for (let d = 0; d <= 99; d++) {
    const dz = String(d).padStart(2, '0');
    const last = lastSeen.get(dz) ?? -1;
    const delay = last === -1 ? total : total - 1 - last;
    // Map dezena to group: 01-04 = G1, 05-08 = G2, ..., 97-00 = G25
    const num = d === 0 ? 100 : d;
    const groupIdx = Math.ceil(num / 4);
    const bicho = BICHOS.find(b => b.group === groupIdx) || BICHOS[0];
    dezenas.push({ dezena: dz, group: groupIdx, bicho, delay, appearances: totalCount.get(dz) || 0 });
  }

  return dezenas
    .filter((d) => d.appearances > 0)
    .sort((a, b) => b.delay - a.delay || a.appearances - b.appearances || a.dezena.localeCompare(b.dezena));
}

function DelayedSection({ results }: { results: AnyResult[] }) {
  const delayedDezenas = useMemo(() => computeDelayedDezenas(results), [results]);
  const delayedGroups = useMemo(() => computeDelayed(results), [results]);
  const mostFrequent = useMemo(() => computeFrequency(results, 'all'), [results]);

  return (
    <div className="space-y-6">
      {/* Dezenas Mais Atrasadas */}
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dezenas Mais Atrasadas ⏰
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Dezenas (00-99) com atraso real no filtro atual — exibindo apenas dezenas que já saíram ao menos 1 vez no período
          </p>
        </CardHeader>
        <CardContent>
          {delayedDezenas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dezenas suficientes para calcular atraso.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {delayedDezenas.slice(0, 20).map((d, i) => (
                <div key={d.dezena} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-2">
                  <Badge variant="secondary" className="w-7 h-6 p-0 flex items-center justify-center text-xs font-bold">{i + 1}</Badge>
                  <span className="text-lg font-mono font-bold text-foreground w-8">{d.dezena}</span>
                  <span className="text-base">{d.bicho.emoji}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    G{String(d.group).padStart(2, '0')} {d.bicho.name}
                  </span>
                  <span className="text-xs font-mono text-destructive font-bold whitespace-nowrap">{d.delay} sorteios</span>
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{d.appearances}x</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bichos Mais Atrasados */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Bichos Mais Atrasados ⏰
            </CardTitle>
            <p className="text-xs text-muted-foreground">Grupos que não saem há mais sorteios</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {delayedGroups.slice(0, 10).map((b, i) => (
              <div key={b.group} className="flex items-center gap-3">
                <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs font-bold">{i + 1}</Badge>
                <span className="text-xl">{b.emoji}</span>
                <span className="text-sm font-medium flex-1">{b.name}</span>
                <span className="text-sm font-mono text-destructive font-bold">{b.delay} sorteios</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mais Frequentes */}
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Trophy className="h-5 w-5" />
              Mais Frequentes 🏆
            </CardTitle>
            <p className="text-xs text-muted-foreground">Bichos que mais saíram no período</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostFrequent.slice(0, 10).map((b, i) => (
              <div key={b.group} className="flex items-center gap-3">
                <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs font-bold">{i + 1}</Badge>
                <span className="text-xl">{b.emoji}</span>
                <span className="text-sm font-medium flex-1">{b.name}</span>
                <span className="text-sm font-mono text-primary font-bold">{b.count}x</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.fullDate || label;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-1">{displayLabel}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// --- Sub Components ---

function BarChartSection({ data, totalResults }: { data: ReturnType<typeof computeFrequency>; totalResults: number }) {
  const chartData = data.map(d => ({
    name: `${d.emoji} ${d.name}`,
    shortName: d.emoji,
    count: d.count,
    pct: totalResults > 0 ? ((d.count / totalResults) * 100).toFixed(1) : '0',
  }));

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Frequência por Bicho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] -mx-2 overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={350}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 20%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 12 }} />
              <YAxis dataKey="shortName" type="category" tick={{ fontSize: 16 }} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PieChartSection({ data, totalDraws }: { data: ReturnType<typeof computeFrequency>; totalDraws: number }) {
  const top10 = data.slice(0, 10);
  const othersCount = data.slice(10).reduce((sum, d) => sum + d.count, 0);
  const pieData = [
    ...top10.map(d => ({
      name: `${d.emoji} ${d.name}`,
      value: d.count,
      pct: totalDraws > 0 ? ((d.count / totalDraws) * 100).toFixed(1) : '0',
    })),
    ...(othersCount > 0 ? [{
      name: 'Outros',
      value: othersCount,
      pct: totalDraws > 0 ? ((othersCount / totalDraws) * 100).toFixed(1) : '0',
    }] : []),
  ];

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-5 w-5 text-accent" />
          Distribuição — Top 10
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] -mx-2 overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={350}>
            <RechartsPieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                label={({ name, pct }) => `${name} ${pct}%`}
                labelLine={{ stroke: 'hsl(215, 12%, 55%)' }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function LineChartSection({ results }: { results: AnyResult[] }) {
  const trendData = useMemo(() => computeTrend(results), [results]);
  const overallFreq = useMemo(() => computeFrequency(results, 'all'), [results]);
  const top5Names = overallFreq.slice(0, 5).map(t => t.name);

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Tendência Diária — Top 5 Bichos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] -mx-2 overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={350}>
            <AreaChart data={trendData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 20%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215, 12%, 55%)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => {
                  const b = BICHOS.find(b => b.name === value);
                  return `${b?.emoji || ''} ${value}`;
                }}
              />
              {top5Names.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i]}
                  fill={CHART_COLORS[i]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function HotColdSection({ results }: { results: AnyResult[] }) {
  const { hot, cold } = useMemo(() => computeHotCold(results), [results]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            Em Alta 🔥
          </CardTitle>
          <p className="text-xs text-muted-foreground">Bichos subindo nos últimos dias</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {hot.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes</p>
          ) : hot.map((b, i) => (
            <div key={b.group} className="flex items-center gap-3">
              <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs font-bold">{i + 1}</Badge>
              <span className="text-xl">{b.emoji}</span>
              <span className="text-sm font-medium flex-1">{b.name}</span>
              <span className="text-sm font-mono text-primary font-bold">+{b.change.toFixed(0)}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <TrendingDown className="h-5 w-5" />
            Em Baixa ❄️
          </CardTitle>
          <p className="text-xs text-muted-foreground">Bichos caindo nos últimos dias</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {cold.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dados insuficientes</p>
          ) : cold.map((b, i) => (
            <div key={b.group} className="flex items-center gap-3">
              <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center text-xs font-bold">{i + 1}</Badge>
              <span className="text-xl">{b.emoji}</span>
              <span className="text-sm font-medium flex-1">{b.name}</span>
              <span className="text-sm font-mono text-destructive font-bold">{b.change.toFixed(0)}%</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StrengthRanking({ results }: { results: AnyResult[] }) {
  const strength = useMemo(() => computeGroupStrength(results), [results]);
  const maxStr = strength[0]?.strength || 1;

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Força do Grupo (Ponderado)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          1° prêmio = 5pts, 2° = 4pts, 3° = 3pts, 4° = 2pts, 5° = 1pt
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {strength.slice(0, 15).map((b, i) => (
            <div key={b.group} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-6 text-right font-bold">
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}
              </span>
              <span className="text-xl w-8">{b.emoji}</span>
              <span className="text-sm font-medium w-24">{b.name}</span>
              <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{
                    width: `${(b.strength / maxStr) * 100}%`,
                    background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})`,
                  }}
                />
              </div>
              <span className="text-sm font-mono font-bold w-12 text-right">{b.strength}pts</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ByPrizePosition({ results }: { results: AnyResult[] }) {
  const positions = useMemo(() => {
    return [1, 2, 3, 4, 5].map(pos => {
      const freq = computeFrequency(results, pos.toString() as PrizeFilter);
      const total = results?.length || 1;
      return {
        pos,
        top3: freq.slice(0, 3).map(d => ({
          ...d,
          pct: ((d.count / total) * 100).toFixed(1),
        })),
      };
    });
  }, [results]);

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Top 3 por Posição do Prêmio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {positions.map(({ pos, top3 }) => (
            <div key={pos} className="space-y-2">
              <h4 className="text-sm font-bold text-center text-muted-foreground">{pos}° Prêmio</h4>
              {top3.map((b, i) => (
                <div key={b.group} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2">
                  <span className="text-sm font-bold text-muted-foreground">{i + 1}.</span>
                  <span className="text-lg">{b.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.count}x ({b.pct}%)</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function Estatisticas() {
  const { data: ptRioResults, isLoading: ptRioLoading } = useRecentResults(500);
  const { data: capitalResults, isLoading: capitalLoading } = useRecentCapitalResults(500);
  const { data: federalResults, isLoading: federalLoading } = useRecentFederalResults(200);
  const [prizeFilter, setPrizeFilter] = useState<PrizeFilter>('all');
  const [source, setSource] = useState<'all' | 'ptrio' | 'capital' | 'federal'>('all');

  const isLoading = ptRioLoading || capitalLoading || federalLoading;

  const activeResults = useMemo<AnyResult[]>(() => {
    const ptrio = (ptRioResults || []) as unknown as AnyResult[];
    const capital = (capitalResults || []) as unknown as AnyResult[];
    const federal = (federalResults || []) as unknown as AnyResult[];
    if (source === 'ptrio') return ptrio;
    if (source === 'capital') return capital;
    if (source === 'federal') return federal;
    return [...ptrio, ...capital, ...federal];
  }, [ptRioResults, capitalResults, federalResults, source]);

  const frequency = useMemo(() => computeFrequency(activeResults, prizeFilter), [activeResults, prizeFilter]);
  const totalDraws = useMemo(() => {
    if (prizeFilter === 'all') return activeResults.length * 5;
    return activeResults.length;
  }, [activeResults, prizeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold tracking-tight">Só Resultados</h1>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Estatísticas Completas
          </h2>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDrawDate(getTodayDateString())} • {activeResults.length} sorteios analisados
          </p>
        </div>

        {/* Source & Prize Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={source} onValueChange={v => setSource(v as typeof source)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ptrio">PT-Rio</SelectItem>
                <SelectItem value="capital">Capital</SelectItem>
                <SelectItem value="federal">Federal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Prêmio:</span>
            <Select value={prizeFilter} onValueChange={v => setPrizeFilter(v as PrizeFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (1° ao 5°)</SelectItem>
                <SelectItem value="1">1° Prêmio</SelectItem>
                <SelectItem value="2">2° Prêmio</SelectItem>
                <SelectItem value="3">3° Prêmio</SelectItem>
                <SelectItem value="4">4° Prêmio</SelectItem>
                <SelectItem value="5">5° Prêmio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="gradient-card border-border/50 animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="charts">Gráficos</TabsTrigger>
              <TabsTrigger value="trends">Tendências</TabsTrigger>
              <TabsTrigger value="strength">Força</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <DelayedSection results={activeResults} />
              <HotColdSection results={activeResults} />
              <ByPrizePosition results={activeResults} />
              <StrengthRanking results={activeResults} />
            </TabsContent>

            <TabsContent value="charts" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChartSection data={frequency} totalResults={totalDraws} />
                <PieChartSection data={frequency} totalDraws={totalDraws} />
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <LineChartSection results={activeResults} />
              <HotColdSection results={activeResults} />
            </TabsContent>

            <TabsContent value="strength" className="space-y-6">
              <StrengthRanking results={activeResults} />
              <ByPrizePosition results={activeResults} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t border-border/30 py-8 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Só Resultados — Estatísticas</p>
        </div>
      </footer>
    </div>
  );
}
