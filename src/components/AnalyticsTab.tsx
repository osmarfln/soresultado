import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Download, Users, Clock, TrendingUp, Eye, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Visit = {
  visit_date: string;
  visit_hour: number;
  page: string;
  visited_at: string;
};

function getBrToday() {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function getBrYesterday() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function formatDateBr(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function AnalyticsTab() {
  const today = getBrToday();
  const yesterday = getBrYesterday();

  const { data: visits, isLoading } = useQuery({
    queryKey: ['page_visits_2days', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_visits')
        .select('visit_date, visit_hour, page, visited_at')
        .gte('visit_date', yesterday)
        .order('visited_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Visit[];
    },
    refetchInterval: 30000,
  });

  const todayVisits = useMemo(() => visits?.filter(v => v.visit_date === today) || [], [visits, today]);
  const yesterdayVisits = useMemo(() => visits?.filter(v => v.visit_date === yesterday) || [], [visits, yesterday]);

  const buildHourlyData = (dayVisits: Visit[]) => {
    const map = new Map<number, number>();
    for (let h = 0; h < 24; h++) map.set(h, 0);
    dayVisits.forEach(v => map.set(v.visit_hour, (map.get(v.visit_hour) || 0) + 1));
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({
        hora: `${String(hour).padStart(2, '0')}h`,
        visitas: count,
        hour,
      }));
  };

  const todayHourly = useMemo(() => buildHourlyData(todayVisits), [todayVisits]);
  const yesterdayHourly = useMemo(() => buildHourlyData(yesterdayVisits), [yesterdayVisits]);

  const peakHourToday = todayHourly.length ? todayHourly.reduce((a, b) => b.visitas > a.visitas ? b : a, todayHourly[0]) : null;
  const peakHourYesterday = yesterdayHourly.length ? yesterdayHourly.reduce((a, b) => b.visitas > a.visitas ? b : a, yesterdayHourly[0]) : null;

  // Pages ranking
  const pagesRanking = useMemo(() => {
    if (!visits?.length) return [];
    const map = new Map<string, { today: number; yesterday: number; total: number }>();
    visits.forEach(v => {
      const entry = map.get(v.page) || { today: 0, yesterday: 0, total: 0 };
      entry.total++;
      if (v.visit_date === today) entry.today++;
      else entry.yesterday++;
      map.set(v.page, entry);
    });
    return Array.from(map.entries())
      .map(([page, counts]) => ({ page, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [visits, today]);

  // Recent visits list (last 30)
  const recentVisits = useMemo(() => (visits || []).slice(0, 30), [visits]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório de Visitas — Só Resultados', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 28);

    doc.setFontSize(12);
    doc.text('Resumo', 14, 40);
    doc.setFontSize(10);
    doc.text(`Hoje (${formatDateBr(today)}): ${todayVisits.length} visitas`, 14, 48);
    doc.text(`Ontem (${formatDateBr(yesterday)}): ${yesterdayVisits.length} visitas`, 14, 54);
    doc.text(`Pico hoje: ${peakHourToday?.hora || '-'} (${peakHourToday?.visitas || 0})`, 14, 60);
    doc.text(`Pico ontem: ${peakHourYesterday?.hora || '-'} (${peakHourYesterday?.visitas || 0})`, 14, 66);

    doc.setFontSize(12);
    doc.text(`Hoje — ${formatDateBr(today)}`, 14, 80);
    (doc as any).autoTable({
      startY: 84,
      head: [['Hora', 'Visitas']],
      body: todayHourly.filter(h => h.visitas > 0).map(h => [h.hora, h.visitas]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
    });

    const afterToday = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Ontem — ${formatDateBr(yesterday)}`, 14, afterToday);
    (doc as any).autoTable({
      startY: afterToday + 4,
      head: [['Hora', 'Visitas']],
      body: yesterdayHourly.filter(h => h.visitas > 0).map(h => [h.hora, h.visitas]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`relatorio-visitas-hoje-ontem.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const DaySection = ({ label, dateStr, dayVisits, hourlyData, peakHour, color }: {
    label: string;
    dateStr: string;
    dayVisits: Visit[];
    hourlyData: { hora: string; visitas: number; hour: number }[];
    peakHour: { hora: string; visitas: number } | null;
    color: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-base font-bold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          {label} — {formatDateBr(dateStr)}
        </h4>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{dayVisits.length} visitas</span>
          {peakHour && peakHour.visitas > 0 && (
            <span className="text-muted-foreground">Pico: <strong>{peakHour.hora}</strong> ({peakHour.visitas})</span>
          )}
        </div>
      </div>
      <Card className="gradient-card border-border/40">
        <CardContent className="pt-4">
          {hourlyData.some(h => h.visitas > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="visitas" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.visitas === peakHour?.visitas && entry.visitas > 0 ? 'hsl(var(--primary))' : color}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma visita registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">Visitas — Hoje e Ontem</h3>
        </div>
        <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
          <Download className="h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{todayVisits.length}</p>
            <p className="text-[11px] text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Users className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{yesterdayVisits.length}</p>
            <p className="text-[11px] text-muted-foreground">Ontem</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{peakHourToday?.hora || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Pico hoje</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{peakHourYesterday?.hora || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Pico ontem</p>
          </CardContent>
        </Card>
      </div>

      {/* Today */}
      <DaySection
        label="🟢 Hoje"
        dateStr={today}
        dayVisits={todayVisits}
        hourlyData={todayHourly}
        peakHour={peakHourToday}
        color="hsl(var(--accent))"
      />

      {/* Yesterday */}
      <DaySection
        label="🔵 Ontem"
        dateStr={yesterday}
        dayVisits={yesterdayVisits}
        hourlyData={yesterdayHourly}
        peakHour={peakHourYesterday}
        color="hsl(142 71% 45%)"
      />

      {/* Recent visits log */}
      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Últimas Visitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentVisits.length > 0 ? (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {recentVisits.map((v, i) => {
                const dt = new Date(v.visited_at);
                const timeStr = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isToday = v.visit_date === today;
                return (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${isToday ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <span className="font-medium">{isToday ? 'Hoje' : 'Ontem'}</span>
                      <span className="text-muted-foreground">{timeStr}</span>
                    </div>
                    <span className="text-muted-foreground">{v.page}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma visita registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
