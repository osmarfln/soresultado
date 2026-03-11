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
import { Clock, Trophy, Calendar, BarChart3, Shield, MapPin, RefreshCw, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { DrawResult } from '@/hooks/useResults';

function getDrawStatus(time: string, hoursMap: Record<string, number>): 'completed' | 'live' | 'waiting' {
  const now = new Date();
  const hour = hoursMap[time] || 0;
  const currentHour = now.getHours();
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
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-lg tracking-wider text-foreground">{milhar}</span>
        <span className="text-xl">{bichoData?.emoji}</span>
        <span className="text-sm text-muted-foreground">G{String(group).padStart(2, '0')} - {bicho}</span>
      </div>
    </div>
  );
}

function DrawCard({ time, result, labelsMap, hoursMap }: { time: string; result?: DrawResult | CapitalResult; labelsMap: Record<string, string>; hoursMap: Record<string, number> }) {
  const status = result ? 'completed' : getDrawStatus(time, hoursMap);

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
        {result ? (
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
  const { data: results, isLoading } = useTodayResults();
  const { data: capitalResults, isLoading: capitalLoading } = useTodayCapitalResults();
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
      const [rioRes, capRes] = await Promise.allSettled([
        supabase.functions.invoke('scrape-results', { body: {} }),
        supabase.functions.invoke('scrape-capital', { body: {} }),
      ]);

      await queryClient.invalidateQueries({ queryKey: ['draw_results'] });
      await queryClient.invalidateQueries({ queryKey: ['capital_results'] });

      const rioData = rioRes.status === 'fulfilled' ? rioRes.value.data : null;
      const capData = capRes.status === 'fulfilled' ? capRes.value.data : null;

      const rioCount = (rioData?.inserted || 0) + (rioData?.updated || 0);
      const capCount = (capData?.inserted || 0) + (capData?.updated || 0);

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
        </div>
      </section>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-10">
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
                  {DRAW_TIMES.map((time, i) => (
                    <React.Fragment key={time}>
                      <DrawCard time={time} result={resultsByTime.get(time)} labelsMap={DRAW_TIME_LABELS} hoursMap={DRAW_TIME_HOURS} />
                      {i === 1 && (
                        <div className="sm:col-span-2">
                          <SponsorSlot position="between_results" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </section>

            {/* Sponsor between sections */}
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
                  {CAPITAL_DRAW_TIMES.map((time, i) => (
                    <React.Fragment key={time}>
                      <DrawCard time={time} result={capitalByTime.get(time)} labelsMap={CAPITAL_DRAW_TIME_LABELS} hoursMap={CAPITAL_DRAW_TIME_HOURS} />
                      {i === 5 && (
                        <div className="sm:col-span-2">
                          <SponsorSlot position="between_results" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </section>

            {/* Federal Section */}
            {federalResult && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-display text-xl font-bold">Federal em Destaque</h3>
                  <Badge variant="secondary" className="ml-2">{federalResult.draw_date}{federalResult.draw_number ? ` • Concurso ${federalResult.draw_number}` : ''}</Badge>
                </div>
                <Card className="gradient-card card-glow border-yellow-500/30 animate-fade-in-up">
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
          </div>

          {/* Sidebar Ads */}
          <aside className="w-full lg:w-72 shrink-0 space-y-6">
            <SponsorSlot position="sidebar" />
            <SponsorSlot position="sidebar" />
          </aside>
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
