import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Calendar, Clock, Download, Eye, FileText, MousePointerClick, TrendingUp, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Visit = {
  visit_date: string;
  visit_hour: number;
  page: string;
  visited_at: string;
};

type Period = '2' | '7' | '30' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '2': 'Hoje + Ontem',
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  all: 'Todo o histórico',
};

const PAGE_LABELS: Record<string, string> = {
  '/': 'Início',
  '/historico': 'Histórico',
  '/estatisticas': 'Estatísticas',
  '/previsoes': 'Previsões',
  '/login': 'Login',
  '/admin': 'Admin',
};

function getBrDate(daysAgo = 0) {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function formatDateBr(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTimeBr(dateTime: string) {
  const date = new Date(dateTime);
  return {
    date: date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    time: date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

function getPageLabel(page: string) {
  return PAGE_LABELS[page] || page;
}

function getPeriodStart(period: Period) {
  if (period === 'all') return null;
  return getBrDate(Number(period) - 1);
}

function getRelativeDateLabel(date: string, today: string, yesterday: string) {
  if (date === today) return 'Hoje';
  if (date === yesterday) return 'Ontem';
  return formatDateBr(date);
}

function getPeriodFileName(period: Period) {
  if (period === 'all') return 'historico-completo';
  return `${period}-dias`;
}

export function AnalyticsTab() {
  const [period, setPeriod] = useState<Period>('7');
  const today = getBrDate(0);
  const yesterday = getBrDate(1);

  const { data: visits = [], isLoading, error } = useQuery({
    queryKey: ['admin-page-visits'],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const allVisits: Visit[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('page_visits')
          .select('visit_date, visit_hour, page, visited_at')
          .order('visited_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = (data || []) as Visit[];
        allVisits.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      return allVisits;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const filteredVisits = useMemo(() => {
    const start = getPeriodStart(period);
    if (!start) return visits;
    return visits.filter(visit => visit.visit_date >= start);
  }, [visits, period]);

  const todayVisits = useMemo(() => visits.filter(visit => visit.visit_date === today), [visits, today]);
  const yesterdayVisits = useMemo(() => visits.filter(visit => visit.visit_date === yesterday), [visits, yesterday]);

  const dailyData = useMemo(() => {
    const map = new Map<string, number>();

    filteredVisits.forEach(visit => {
      map.set(visit.visit_date, (map.get(visit.visit_date) || 0) + 1);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fullDate, total]) => ({
        fullDate,
        date: formatDateBr(fullDate),
        label: getRelativeDateLabel(fullDate, today, yesterday),
        visitas: total,
      }));
  }, [filteredVisits, today, yesterday]);

  const hourlyData = useMemo(() => {
    const map = new Map<number, number>();
    for (let hour = 0; hour < 24; hour++) map.set(hour, 0);

    filteredVisits.forEach(visit => {
      map.set(visit.visit_hour, (map.get(visit.visit_hour) || 0) + 1);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, total]) => ({
        hour,
        hora: `${String(hour).padStart(2, '0')}h`,
        visitas: total,
      }));
  }, [filteredVisits]);

  const pagesRanking = useMemo(() => {
    const map = new Map<string, { page: string; label: string; total: number; today: number; yesterday: number }>();

    filteredVisits.forEach(visit => {
      const current = map.get(visit.page) || {
        page: visit.page,
        label: getPageLabel(visit.page),
        total: 0,
        today: 0,
        yesterday: 0,
      };

      current.total += 1;
      if (visit.visit_date === today) current.today += 1;
      if (visit.visit_date === yesterday) current.yesterday += 1;

      map.set(visit.page, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredVisits, today, yesterday]);

  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { fullDate: string; total: number; pages: Map<string, number> }>();

    filteredVisits.forEach(visit => {
      const day = map.get(visit.visit_date) || {
        fullDate: visit.visit_date,
        total: 0,
        pages: new Map<string, number>(),
      };

      day.total += 1;
      day.pages.set(visit.page, (day.pages.get(visit.page) || 0) + 1);
      map.set(visit.visit_date, day);
    });

    return Array.from(map.values())
      .sort((a, b) => b.fullDate.localeCompare(a.fullDate))
      .map(day => ({
        fullDate: day.fullDate,
        label: getRelativeDateLabel(day.fullDate, today, yesterday),
        total: day.total,
        pages: Array.from(day.pages.entries())
          .map(([page, total]) => ({ page, label: getPageLabel(page), total }))
          .sort((a, b) => b.total - a.total),
      }));
  }, [filteredVisits, today, yesterday]);

  const recentVisits = useMemo(() => filteredVisits.slice(0, 60), [filteredVisits]);

  const totalVisits = filteredVisits.length;
  const activeDays = dailyData.length;
  const peakDate = totalVisits > 0 ? dailyData.reduce((best, current) => (current.visitas > best.visitas ? current : best), dailyData[0]) : null;
  const peakHour = totalVisits > 0 ? hourlyData.reduce((best, current) => (current.visitas > best.visitas ? current : best), hourlyData[0]) : null;
  const topPage = pagesRanking[0] || null;

  const exportPDF = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório de Visitas — Só Resultados', 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${generatedAt}`, 14, 26);
    doc.text(`Período: ${PERIOD_LABELS[period]}`, 14, 32);

    (doc as any).autoTable({
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de visitas no período', String(totalVisits)],
        ['Visitas hoje', String(todayVisits.length)],
        ['Visitas ontem', String(yesterdayVisits.length)],
        ['Dias com acessos', String(activeDays)],
        ['Data com mais visitas', peakDate ? `${peakDate.label} (${peakDate.visitas})` : '-'],
        ['Horário com mais visitas', peakHour ? `${peakHour.hora} (${peakHour.visitas})` : '-'],
        ['Página mais acessada', topPage ? `${topPage.label} (${topPage.total})` : '-'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
    });

    const afterSummary = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Visitas por data', 14, afterSummary);
    (doc as any).autoTable({
      startY: afterSummary + 4,
      head: [['Data', 'Total']],
      body: dailyData.map(day => [day.label, day.visitas]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    const afterDates = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Páginas mais acessadas', 14, afterDates);
    (doc as any).autoTable({
      startY: afterDates + 4,
      head: [['Página', 'Hoje', 'Ontem', 'Total']],
      body: pagesRanking.map(page => [page.label, page.today, page.yesterday, page.total]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    const afterPages = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Log detalhado', 14, afterPages);
    (doc as any).autoTable({
      startY: afterPages + 4,
      head: [['Data', 'Hora', 'Página']],
      body: recentVisits.map(visit => {
        const formatted = formatDateTimeBr(visit.visited_at);
        return [formatted.date, formatted.time, getPageLabel(visit.page)];
      }),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
    });

    doc.save(`relatorio-visitas-${getPeriodFileName(period)}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="gradient-card border-border/40">
        <CardContent className="py-10 text-center">
          <p className="font-semibold">Não foi possível carregar o relatório de visitas.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Erro desconhecido ao consultar as visitas.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display text-lg font-bold">Visitas organizadas</h3>
            <p className="text-sm text-muted-foreground">Relatório completo por data, horário, páginas e acessos detalhados.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Hoje + Ontem</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Todo o histórico</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Users className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-bold">{totalVisits}</p>
            <p className="text-[11px] text-muted-foreground">Total no período</p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Calendar className="mx-auto mb-1 h-5 w-5 text-accent" />
            <p className="font-display text-2xl font-bold">{activeDays}</p>
            <p className="text-[11px] text-muted-foreground">Datas com acessos</p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-bold">{peakDate?.label || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Data com mais visitas</p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Clock className="mx-auto mb-1 h-5 w-5 text-accent" />
            <p className="font-display text-2xl font-bold">{peakHour?.hora || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Horário de pico</p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <MousePointerClick className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-bold">{todayVisits.length}</p>
            <p className="text-[11px] text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <FileText className="mx-auto mb-1 h-5 w-5 text-accent" />
            <p className="truncate font-display text-xl font-bold">{topPage?.label || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Página líder</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gradient-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-primary" />
              Visitas por data
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(value) => `Data: ${value}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="visitas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma visita registrada no período.</p>
            )}
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-accent" />
              Visitas por horário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyData.some(hour => hour.visitas > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hora" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="visitas" radius={[4, 4, 0, 0]}>
                    {hourlyData.map((hour, index) => (
                      <Cell
                        key={hour.hora}
                        fill={hour.visitas > 0 && hour.hora === peakHour?.hora ? 'hsl(var(--primary))' : 'hsl(var(--accent))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma visita registrada no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Páginas mais acessadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagesRanking.length > 0 ? (
            <div className="space-y-2">
              {pagesRanking.map((page, index) => (
                <div key={page.page} className="flex flex-col gap-2 rounded-lg border border-border/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-muted-foreground">#{index + 1}</span>
                    <div>
                      <p className="font-semibold">{page.label}</p>
                      <p className="text-xs text-muted-foreground">{page.page}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-primary">Hoje: {page.today}</span>
                    <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-accent">Ontem: {page.yesterday}</span>
                    <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 font-semibold">Total: {page.total}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem páginas acessadas no período.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-accent" />
            Relatório diário por data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyBreakdown.length > 0 ? (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {dailyBreakdown.map((day) => (
                <div key={day.fullDate} className="rounded-lg border border-border/50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{day.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateBr(day.fullDate)}</p>
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-sm font-semibold">
                      {day.total} visitas
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.pages.map((page) => (
                      <span key={`${day.fullDate}-${page.page}`} className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                        {page.label}: <strong className="text-foreground">{page.total}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem datas com visitas para exibir.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            Log detalhado de acessos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentVisits.length > 0 ? (
            <div className="max-h-[460px] overflow-auto rounded-lg border border-border/50">
              <div className="grid min-w-[720px] grid-cols-[120px_110px_140px_1fr] border-b border-border/50 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>Data</span>
                <span>Horário</span>
                <span>Referência</span>
                <span>Página</span>
              </div>

              {recentVisits.map((visit, index) => {
                const formatted = formatDateTimeBr(visit.visited_at);
                const isToday = visit.visit_date === today;
                const label = getRelativeDateLabel(visit.visit_date, today, yesterday);

                return (
                  <div
                    key={`${visit.visited_at}-${visit.page}-${index}`}
                    className="grid min-w-[720px] grid-cols-[120px_110px_140px_1fr] items-center border-b border-border/30 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span>{formatted.date}</span>
                    <span className="font-medium">{formatted.time}</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${isToday ? 'bg-primary' : 'bg-accent'}`} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <div>
                      <p className="font-medium">{getPageLabel(visit.page)}</p>
                      <p className="text-xs text-muted-foreground">{visit.page}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum acesso registrado no período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
