import React, { useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';
import { DRAW_TIMES, DRAW_TIME_LABELS, DRAW_TIME_HOURS, getBichoByGroup, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS, CAPITAL_DRAW_TIME_HOURS } from '@/lib/capital';
import { SP_DRAW_TIMES, SP_DRAW_TIME_LABELS, SP_DRAW_TIME_HOURS } from '@/lib/sp';
import { useTodayResults } from '@/hooks/useResults';
import { useTodayCapitalResults } from '@/hooks/useCapitalResults';
import { useTodaySpResults } from '@/hooks/useSpResults';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import type { CapitalResult } from '@/hooks/useCapitalResults';
import type { SpResult } from '@/hooks/useSpResults';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SponsorSlot } from '@/components/SponsorSlot';
import { Clock, Trophy, Calendar, BarChart3, Shield, MapPin, RefreshCw, Loader2, Brain, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TickerBanner } from '@/components/TickerBanner';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import type { DrawResult } from '@/hooks/useResults';

function getCurrentHourBRT(): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  return parseInt(hourStr, 10);
}

function getDrawStatus(time: string, hoursMap: Record<string, number>): 'completed' | 'live' | 'waiting' {
  const hour = hoursMap[time] || 0;
  const currentHour = getCurrentHourBRT();
  if (currentHour > hour) return 'completed';
  if (currentHour === hour) return 'live';
  return 'waiting';
}

function StatusBadge({ status }: { status: 'completed' | 'live' | 'waiting' }) {
  if (status === 'completed')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Concluído
      </span>
    );
  if (status === 'live')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-live bg-live/10 border border-live/20 px-2 py-0.5 rounded-full status-live">
        <span className="w-1.5 h-1.5 rounded-full bg-live" />
        Ao Vivo
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">
      Aguardando
    </span>
  );
}

function PrizeRow({ position, milhar, group, bicho, isFirst }: { position: number; milhar: string; group: number; bicho: string; isFirst?: boolean }) {
  const bichoData = getBichoByGroup(group);
  return (
    <div className={`flex items-center gap-3 py-2.5 ${isFirst ? '' : 'border-t border-border/30'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isFirst ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {position}
      </span>
      <span className={`font-display font-bold tracking-wider shrink-0 ${isFirst ? 'text-xl text-foreground' : 'text-base text-foreground/80'}`}>
        {milhar}
      </span>
      <span className="text-lg shrink-0">{bichoData?.emoji}</span>
      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
        G{String(group).padStart(2, '0')} · {bicho}
      </span>
    </div>
  );
}

function DrawCard({ time, result, labelsMap, hoursMap, index }: { time: string; result?: DrawResult | CapitalResult | SpResult; labelsMap: Record<string, string>; hoursMap: Record<string, number>; index: number }) {
  const status = result ? 'completed' : getDrawStatus(time, hoursMap);

  return (
    <Card className={`gradient-card card-glow border-border/40 animate-fade-in-up stagger-${Math.min(index + 1, 6)} overflow-hidden`}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-sm">{labelsMap[time]}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <CardContent className="pt-0 pb-4">
        {result ? (
          <div>
            <PrizeRow position={1} milhar={result.prize_1_milhar} group={result.prize_1_group} bicho={result.prize_1_bicho} isFirst />
            <PrizeRow position={2} milhar={result.prize_2_milhar} group={result.prize_2_group} bicho={result.prize_2_bicho} />
            <PrizeRow position={3} milhar={result.prize_3_milhar} group={result.prize_3_group} bicho={result.prize_3_bicho} />
            <PrizeRow position={4} milhar={result.prize_4_milhar} group={result.prize_4_group} bicho={result.prize_4_bicho} />
            <PrizeRow position={5} milhar={result.prize_5_milhar} group={result.prize_5_group} bicho={result.prize_5_bicho} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
            <Clock className="h-8 w-8 mb-2" />
            <p className="text-xs">Aguardando resultado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Index() {
  useTrackVisit('/');
  const { user, isAdmin } = useAuth();
  const { data: results, isLoading, dataUpdatedAt: rioUpdatedAt } = useTodayResults();
  const { data: capitalResults, isLoading: capitalLoading, dataUpdatedAt: capUpdatedAt } = useTodayCapitalResults();
  const { data: spResults, isLoading: spLoading, dataUpdatedAt: spUpdatedAt } = useTodaySpResults();
  const { data: federalResult } = useLatestFederalResult();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = getTodayDateString();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [rioRes, capRes, spRes] = await Promise.allSettled([
        supabase.functions.invoke('scrape-results', { body: {} }),
        supabase.functions.invoke('scrape-capital', { body: {} }),
        supabase.functions.invoke('scrape-sp', { body: {} }),
      ]);

      const rioData = rioRes.status === 'fulfilled' ? rioRes.value.data : null;
      const capData = capRes.status === 'fulfilled' ? capRes.value.data : null;
      const spData = spRes.status === 'fulfilled' ? spRes.value.data : null;

      const rioCount = (rioData?.inserted || 0) + (rioData?.updated || 0);
      const capCount = (capData?.inserted || 0) + (capData?.updated || 0);
      const spCount = (spData?.inserted || 0) + (spData?.updated || 0);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['draw_results'] }),
        queryClient.invalidateQueries({ queryKey: ['capital_results'] }),
        queryClient.invalidateQueries({ queryKey: ['federal_results'] }),
        queryClient.invalidateQueries({ queryKey: ['sp_results'] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['draw_results', 'today'] }),
        queryClient.refetchQueries({ queryKey: ['capital_results', 'today'] }),
        queryClient.refetchQueries({ queryKey: ['federal_results', 'latest'] }),
      ]);

      toast({
        title: '✅ Atualizado!',
        description: `PT-Rio: ${rioCount} resultado(s) | Capital: ${capCount} resultado(s)`,
      });
    } catch (err: any) {
      toast({ title: 'Erro na atualização', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const resultsByTime = new Map<string, DrawResult>();
  results?.forEach(r => resultsByTime.set(r.draw_time, r));

  const capitalByTime = new Map<string, CapitalResult>();
  capitalResults?.forEach(r => capitalByTime.set(r.draw_time, r));

  const displayDate = results && results.length > 0
    ? results[0].draw_date
    : capitalResults && capitalResults.length > 0
      ? capitalResults[0].draw_date
      : today;

  return (
    <div className="min-h-screen bg-background">
      <TickerBanner />

      {/* Header */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logoImg} alt="Só Resultados" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link to="/historico" className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md transition-colors hover:bg-secondary/60 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
            <Link to="/estatisticas" className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md transition-colors hover:bg-secondary/60 flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Estatísticas</span>
            </Link>
            <Link to="/previsoes" className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md transition-colors hover:bg-secondary/60 flex items-center gap-1">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previsões</span>
            </Link>
            <Link
              to={user ? '/admin' : '/login'}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1.5"
            >
              <Shield className="h-3.5 w-3.5" />
            </Link>
            {isAdmin && (
              <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px] px-1.5 py-0">
                Admin
              </Badge>
            )}
          </nav>
        </div>
      </header>

      <SponsorSlot position="header" className="container mx-auto px-4 pt-3" />

      {/* Hero — compact and elegant */}
      <section className="gradient-hero">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
            {formatDrawDate(displayDate)}
          </p>
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold mb-3 text-foreground">
            Resultado do Jogo do Bicho
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 bg-card/60 border border-border/40 rounded-lg px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-sm font-semibold text-foreground">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border/40"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {(() => {
            const lastUpdate = Math.max(rioUpdatedAt || 0, capUpdatedAt || 0);
            if (!lastUpdate) return null;
            const diffMs = currentTime.getTime() - lastUpdate;
            const diffMin = Math.floor(diffMs / 60000);
            const label = diffMin < 1 ? 'agora' : diffMin === 1 ? 'há 1 min' : `há ${diffMin} min`;
            return (
              <p className="text-[10px] text-muted-foreground mt-2">
                Atualizado {label}
              </p>
            );
          })()}
        </div>
      </section>

      {/* Main content */}
      <main className="container mx-auto px-4 py-5 max-w-4xl space-y-6">

        {/* Federal Section */}
        {federalResult && (
          <section className="section-divider pl-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]" />
              <h3 className="font-display text-lg sm:text-xl font-bold text-gold-gradient tracking-tight">
                FEDERAL
              </h3>
              <span className="text-[10px] text-accent/80 font-medium ml-auto">
                {federalResult.draw_date.split('-').reverse().join('/')}{federalResult.draw_number ? ` · Nº ${federalResult.draw_number}` : ''}
              </span>
            </div>
            <Card className="gradient-card border-accent/20 shadow-[0_0_20px_hsl(var(--accent)/0.08)] animate-fade-in-up overflow-hidden">
              <CardContent className="pt-4 pb-4">
                <PrizeRow position={1} milhar={federalResult.prize_1_milhar} group={federalResult.prize_1_group} bicho={federalResult.prize_1_bicho} isFirst />
                <PrizeRow position={2} milhar={federalResult.prize_2_milhar} group={federalResult.prize_2_group} bicho={federalResult.prize_2_bicho} />
                <PrizeRow position={3} milhar={federalResult.prize_3_milhar} group={federalResult.prize_3_group} bicho={federalResult.prize_3_bicho} />
                <PrizeRow position={4} milhar={federalResult.prize_4_milhar} group={federalResult.prize_4_group} bicho={federalResult.prize_4_bicho} />
                <PrizeRow position={5} milhar={federalResult.prize_5_milhar} group={federalResult.prize_5_group} bicho={federalResult.prize_5_bicho} />
              </CardContent>
            </Card>
          </section>
        )}

        {federalResult && <SponsorSlot position="between_results" />}

        {/* PT-Rio Section */}
        <section className="rounded-xl border border-red-500/30 p-4">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="h-5 w-5 text-primary" />
            <div className="flex items-center gap-2">
              <div className="flex-none h-6 w-px bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
              <h3 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-blue-400 via-primary to-blue-600 bg-clip-text text-transparent drop-shadow-sm">PT-Rio</span>
              </h3>
              <div className="flex-none h-6 w-px bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-blue-500/40 to-transparent" />
            <span className="text-[10px] text-muted-foreground">{DRAW_TIMES.length} sorteios</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DRAW_TIMES.map(t => (
                <Card key={t} className="gradient-card border-border/30 animate-pulse h-56" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DRAW_TIMES.map((time, i) => (
                <DrawCard key={time} time={time} result={resultsByTime.get(time)} labelsMap={DRAW_TIME_LABELS} hoursMap={DRAW_TIME_HOURS} index={i} />
              ))}
            </div>
          )}
        </section>

        <SponsorSlot position="between_results" />

        {/* Capital Section */}
        <section className="rounded-xl border border-red-500/30 p-4">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="h-5 w-5 text-accent" />
            <div className="flex items-center gap-2">
              <div className="flex-none h-6 w-px bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
              <h3 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-amber-400 via-accent to-yellow-500 bg-clip-text text-transparent drop-shadow-sm">Capital</span>
              </h3>
              <div className="flex-none h-6 w-px bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-blue-500/40 to-transparent" />
            <span className="text-[10px] text-muted-foreground">{CAPITAL_DRAW_TIMES.length} sorteios</span>
          </div>
          {capitalLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAPITAL_DRAW_TIMES.slice(0, 4).map(t => (
                <Card key={t} className="gradient-card border-border/30 animate-pulse h-56" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAPITAL_DRAW_TIMES.map((time, i) => (
                <DrawCard key={time} time={time} result={capitalByTime.get(time)} labelsMap={CAPITAL_DRAW_TIME_LABELS} hoursMap={CAPITAL_DRAW_TIME_HOURS} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section className="grid grid-cols-3 gap-2">
          <Link to="/historico" className="flex flex-col items-center gap-1.5 bg-card/60 border border-border/30 rounded-lg py-3 px-2 hover:bg-secondary/40 transition-colors group">
            <Calendar className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">Histórico</span>
          </Link>
          <Link to="/estatisticas" className="flex flex-col items-center gap-1.5 bg-card/60 border border-border/30 rounded-lg py-3 px-2 hover:bg-secondary/40 transition-colors group">
            <BarChart3 className="h-5 w-5 text-accent group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">Estatísticas</span>
          </Link>
          <Link to="/previsoes" className="flex flex-col items-center gap-1.5 bg-card/60 border border-border/30 rounded-lg py-3 px-2 hover:bg-secondary/40 transition-colors group">
            <Brain className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">Previsões IA</span>
          </Link>
        </section>

        {/* Sponsors */}
        <div className="space-y-3">
          <SponsorSlot position="sidebar" />
          <SponsorSlot position="sidebar" />
        </div>
      </main>

      {/* Footer Sponsor */}
      <div className="container mx-auto px-4 pb-3">
        <SponsorSlot position="footer" />
      </div>

      {/* Footer */}
      <footer className="border-t border-border/20 py-5 bg-card/30">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2">
          <img src={logoImg} alt="Só Resultados" className="h-5 w-auto opacity-50" />
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Só Resultados
          </p>
        </div>
      </footer>
    </div>
  );
}
