import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Download, Users, Clock, TrendingUp, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Visit = {
  visit_date: string;
  visit_hour: number;
};

export function AnalyticsTab() {
  const [period, setPeriod] = useState<'7' | '15' | '30'>('7');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['page_visits', period],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));
      const sinceStr = since.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('page_visits')
        .select('visit_date, visit_hour')
        .gte('visit_date', sinceStr)
        .order('visit_date', { ascending: true });

      if (error) throw error;
      return (data || []) as Visit[];
    },
    refetchInterval: 60000,
  });

  const dailyData = useMemo(() => {
    if (!visits?.length) return [];
    const map = new Map<string, number>();
    visits.forEach(v => map.set(v.visit_date, (map.get(v.visit_date) || 0) + 1));
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: date.split('-').slice(1).reverse().join('/'),
        fullDate: date,
        visitas: count,
      }));
  }, [visits]);

  const hourlyData = useMemo(() => {
    if (!visits?.length) return [];
    const map = new Map<number, number>();
    for (let h = 0; h < 24; h++) map.set(h, 0);
    visits.forEach(v => map.set(v.visit_hour, (map.get(v.visit_hour) || 0) + 1));
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({
        hora: `${String(hour).padStart(2, '0')}h`,
        visitas: count,
      }));
  }, [visits]);

  const totalVisits = visits?.length || 0;
  const avgPerDay = dailyData.length ? Math.round(totalVisits / dailyData.length) : 0;
  const peakHour = hourlyData.length
    ? hourlyData.reduce((a, b) => (b.visitas > a.visitas ? b : a), hourlyData[0])
    : null;
  const peakDay = dailyData.length
    ? dailyData.reduce((a, b) => (b.visitas > a.visitas ? b : a), dailyData[0])
    : null;

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório de Visitas — Só Resultados', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 28);
    doc.text(`Período: últimos ${period} dias`, 14, 34);

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo', 14, 46);
    doc.setFontSize(10);
    doc.text(`Total de visitas: ${totalVisits}`, 14, 54);
    doc.text(`Média por dia: ${avgPerDay}`, 14, 60);
    doc.text(`Horário de pico: ${peakHour?.hora || '-'} (${peakHour?.visitas || 0} visitas)`, 14, 66);
    doc.text(`Dia de pico: ${peakDay?.date || '-'} (${peakDay?.visitas || 0} visitas)`, 14, 72);

    // Daily table
    doc.setFontSize(12);
    doc.text('Visitas por Dia', 14, 86);

    (doc as any).autoTable({
      startY: 90,
      head: [['Data', 'Visitas']],
      body: dailyData.map(d => [d.date, d.visitas]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
    });

    const afterDaily = (doc as any).lastAutoTable.finalY + 10;

    // Hourly table
    doc.setFontSize(12);
    doc.text('Visitas por Hora', 14, afterDaily);

    (doc as any).autoTable({
      startY: afterDaily + 4,
      head: [['Hora', 'Visitas']],
      body: hourlyData.filter(h => h.visitas > 0).map(h => [h.hora, h.visitas]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`relatorio-visitas-${period}dias.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-bold">Histórico de Visitas</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as '7' | '15' | '30')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{totalVisits}</p>
            <p className="text-[11px] text-muted-foreground">Total de visitas</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{avgPerDay}</p>
            <p className="text-[11px] text-muted-foreground">Média/dia</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{peakHour?.hora || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Horário de pico</p>
          </CardContent>
        </Card>
        <Card className="gradient-card border-border/40">
          <CardContent className="py-4 text-center">
            <Users className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold font-display">{peakDay?.date || '-'}</p>
            <p className="text-[11px] text-muted-foreground">Dia de pico</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Visitas por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={val => `Data: ${val}`}
                />
                <Line type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma visita registrada no período.</p>
          )}
        </CardContent>
      </Card>

      {/* Hourly chart */}
      <Card className="gradient-card border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            Visitas por Hora do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hourlyData.some(h => h.visitas > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
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
                <Bar dataKey="visitas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma visita registrada no período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
