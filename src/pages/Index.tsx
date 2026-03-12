import React, { useState, useEffect } from 'react';
import { DRAW_TIMES, DRAW_TIME_LABELS, DRAW_TIME_HOURS, getBichoByGroup, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS, CAPITAL_DRAW_TIME_HOURS } from '@/lib/capital';
import { useTodayResults } from '@/hooks/useResults';
import { useTodayCapitalResults } from '@/hooks/useCapitalResults';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import type { CapitalResult } from '@/hooks/useCapitalResults';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SponsorSlot } from '@/components/SponsorSlot';
import { Clock, Trophy, Calendar, BarChart3, Shield, MapPin, RefreshCw, Loader2, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TickerBanner } from '@/components/TickerBanner';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
  if (status === 'completed') return <Badge className="bg-primary/20 text-primary border-primary/30">Concluído</Badge>;
  if (status === 'live') return <Badge className="bg-live/20 text-live border-live/30 status-live">Ao Vivo</Badge>;
  return <Badge variant="secondary">Aguardando</Badge>;
}

function PrizeRow({ label, milhar, group, bicho }: { label: string; milhar: string; group: number; bicho: string }) {
  const bichoData = getBichoByGroup(group);
  return (
    <div className="flex items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground font-medium w-20 shrink-0">{label}</span>
      <span className="font-display font-bold text-lg tracking-wider text-foreground w-16 text-right shrink-0">{milhar}</span>
      <span className="text-xl mx-2 shrink-0">{bichoData?.emoji}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">G{String(group).padStart(2, '0')} - {bicho}</span>
    </div>
  );
}

function DrawCard({ time, result, labelsMap, hoursMap }: { time: string; result?: DrawResult | CapitalResult; labelsMap: Record<string, string>; hoursMap: Record<string, number> }) {
  const scheduleStatus = getDrawStatus(time, hoursMap);
  const canShowResult = Boolean(result) && scheduleStatus !== 'waiting';
  const status = canShowResult ? 'completed' : scheduleStatus;

  return (
    <Card className="gradient-card card-glow border-border/50 animate-fade-in-up">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            {labelsMap[time]}
          </CardTitle>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        {canShowResult && result ? (
          <div className="space-y-1">
            <PrizeRow label="1° Prêmio" milhar={result.prize_1_milhar} group={result.prize_1_group} bicho={result.prize_1_bicho} />
            <PrizeRow label="2° Prêmio" milhar={result.prize_2_milhar} group={result.prize_2_group} bicho={result.prize_2_bicho} />
            <PrizeRow label="3° Prêmio" milhar={result.prize_3_milhar} group={result.prize_3_group} bicho={result.prize_3_bicho} />
            <PrizeRow label="4° Prêmio" milhar={result.prize_4_milhar} group={result.prize_4_group} bicho={result.prize_4_bicho} />
            <PrizeRow label="5° Prêmio" milhar={result.prize_5_milhar} group={result.prize_5_group} bicho={result.prize_5_bicho} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Resultado ainda não disponível</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Index() {
  const { user, isAdmin } = useAuth();
  const { data: results, isLoading, dataUpdatedAt: rioUpdatedAt } = useTodayResults();
  const { data: capitalResults, isLoading: capitalLoading, dataUpdatedAt: capUpdatedAt } = useTodayCapitalResults();
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
      // First try Firecrawl scrapers
      const [rioRes, capRes] = await Promise.allSettled([
        supabase.functions.invoke('scrape-results', { body: {} }),
        supabase.functions.invoke('scrape-capital', { body: {} }),
      ]);

      const rioData = rioRes.status === 'fulfilled' ? rioRes.value.data : null;
      const capData = capRes.status === 'fulfilled' ? capRes.value.data : null;

      let rioCount = (rioData?.inserted || 0) + (rioData?.updated || 0);
      let capCount = (capData?.inserted || 0) + (capData?.updated || 0);

      // If Firecrawl didn't find much, try Perplexity as fallback
      if (rioCount === 0 || capCount === 0) {
        const fallbacks = [];
        if (rioCount === 0) fallbacks.push(supabase.functions.invoke('scrape-perplexity', { body: { type: 'rio' } }));
        if (capCount === 0) fallbacks.push(supabase.functions.invoke('scrape-perplexity', { body: { type: 'capital' } }));
        
        const fallbackResults = await Promise.allSettled(fallbacks);
        for (const fr of fallbackResults) {
          if (fr.status === 'fulfilled' && fr.value.data) {
            const d = fr.value.data;
            if (d.type === 'rio') rioCount += (d.inserted || 0) + (d.updated || 0);
            else capCount += (d.inserted || 0) + (d.updated || 0);
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['draw_results'] });
      await queryClient.invalidateQueries({ queryKey: ['capital_results'] });

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
      {/* Ticker */}
      <TickerBanner />
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="font-display text-lg font-bold tracking-tight">Jogos Online</h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link to="/historico" className="text-sm font-medium text-foreground bg-secondary/60 hover:bg-secondary px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Histórico</span>
            </Link>
            <Link to="/estatisticas" className="text-sm font-medium text-foreground bg-secondary/60 hover:bg-secondary px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-accent" />
              <span>Estatísticas</span>
            </Link>
            <Link to="/previsoes" className="text-sm font-medium text-foreground bg-secondary/60 hover:bg-secondary px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              <span>Previsões</span>
            </Link>
            <Link
              to={user ? '/admin' : '/login'}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Shield className="h-4 w-4" />
              <span>{user ? 'Admin' : 'Login'}</span>
            </Link>
            {isAdmin && (
              <Badge className="bg-primary/20 text-primary border-primary/30 ml-1">
                <Shield className="h-3 w-3 mr-1" /> Admin
              </Badge>
            )}
          </nav>
        </div>
      </header>

      {/* Sponsor Header Banner */}
      <SponsorSlot position="header" className="container mx-auto px-4 pt-4" />

      {/* Hero */}
      <section className="gradient-hero border-b border-border/30">
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
            Resultado do Jogo do Bicho
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            {formatDrawDate(displayDate)}
          </p>
          <p className="text-primary font-mono text-lg sm:text-xl font-bold mt-1">
            <Clock className="h-4 w-4 inline-block mr-1 -mt-0.5" />
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          {(() => {
            const lastUpdate = Math.max(rioUpdatedAt || 0, capUpdatedAt || 0);
            if (!lastUpdate) return null;
            const diffMs = currentTime.getTime() - lastUpdate;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const label = diffMin < 1 ? 'agora' : diffMin === 1 ? 'há 1 minuto' : `há ${diffMin} minutos`;
            return (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização: {label}
              </p>
            );
          })()}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            {refreshing ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Atualizando...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar Resultados</>
            )}
          </Button>
        </div>
      </section>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">

        {/* Federal Section */}
        {federalResult && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="h-6 w-6 text-yellow-400 drop-shadow-[0_0_6px_rgba(255,215,0,0.6)]" />
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-gold-gradient tracking-tight">
                FEDERAL
              </h3>
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 ml-2">
                {federalResult.draw_date.split('-').reverse().join('/')}{federalResult.draw_number ? ` • Concurso ${federalResult.draw_number}` : ''}
              </Badge>
            </div>
            <Card className="gradient-card border-yellow-500/40 shadow-[0_0_20px_rgba(255,215,0,0.15)] animate-fade-in-up">
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <PrizeRow label="1° Prêmio" milhar={federalResult.prize_1_milhar} group={federalResult.prize_1_group} bicho={federalResult.prize_1_bicho} />
                  <PrizeRow label="2° Prêmio" milhar={federalResult.prize_2_milhar} group={federalResult.prize_2_group} bicho={federalResult.prize_2_bicho} />
                  <PrizeRow label="3° Prêmio" milhar={federalResult.prize_3_milhar} group={federalResult.prize_3_group} bicho={federalResult.prize_3_bicho} />
                  <PrizeRow label="4° Prêmio" milhar={federalResult.prize_4_milhar} group={federalResult.prize_4_group} bicho={federalResult.prize_4_bicho} />
                  <PrizeRow label="5° Prêmio" milhar={federalResult.prize_5_milhar} group={federalResult.prize_5_group} bicho={federalResult.prize_5_bicho} />
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {federalResult && <SponsorSlot position="between_results" />}

        {/* PT-Rio Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-display text-xl font-bold">PT-Rio</h3>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DRAW_TIMES.map(t => (
                <Card key={t} className="gradient-card border-border/50 animate-pulse h-64" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DRAW_TIMES.map((time) => (
                <DrawCard key={time} time={time} result={resultsByTime.get(time)} labelsMap={DRAW_TIME_LABELS} hoursMap={DRAW_TIME_HOURS} />
              ))}
            </div>
          )}
        </section>

        <SponsorSlot position="between_results" />

        {/* Capital Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-accent" />
            <h3 className="font-display text-xl font-bold">Capital</h3>
          </div>
          {capitalLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CAPITAL_DRAW_TIMES.slice(0, 4).map(t => (
                <Card key={t} className="gradient-card border-border/50 animate-pulse h-64" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CAPITAL_DRAW_TIMES.map((time) => (
                <DrawCard key={time} time={time} result={capitalByTime.get(time)} labelsMap={CAPITAL_DRAW_TIME_LABELS} hoursMap={CAPITAL_DRAW_TIME_HOURS} />
              ))}
            </div>
          )}
        </section>

        {/* Sponsors */}
        <div className="space-y-4">
          <SponsorSlot position="sidebar" />
          <SponsorSlot position="sidebar" />
        </div>
      </main>

      {/* Footer Sponsor */}
      <div className="container mx-auto px-4 pb-4">
        <SponsorSlot position="footer" />
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Jogos Online — Resultados do Jogo do Bicho</p>
        </div>
      </footer>
    </div>
  );
}
