import { DRAW_TIMES, DRAW_TIME_LABELS, DRAW_TIME_HOURS, getBichoByGroup, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { useTodayResults } from '@/hooks/useResults';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SponsorSlot } from '@/components/SponsorSlot';
import { Clock, Trophy, Calendar, BarChart3, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DrawResult } from '@/hooks/useResults';

function getDrawStatus(time: string): 'completed' | 'live' | 'waiting' {
  const now = new Date();
  const hour = DRAW_TIME_HOURS[time] || 0;
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

function DrawCard({ time, result }: { time: string; result?: DrawResult }) {
  const status = result ? 'completed' : getDrawStatus(time);

  return (
    <Card className="gradient-card card-glow border-border/50 animate-fade-in-up">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            PT-Rio {DRAW_TIME_LABELS[time]}
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
  const today = getTodayDateString();

  const resultsByTime = new Map<string, DrawResult>();
  results?.forEach(r => resultsByTime.set(r.draw_time, r));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold tracking-tight">Jogos Online</h1>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/historico" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
            <Link to="/estatisticas" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Estatísticas</span>
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
        <div className="container mx-auto px-4 py-10 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Resultado do Jogo do Bicho
          </h2>
          <p className="text-muted-foreground text-lg">
            PT-Rio — {formatDrawDate(today)}
          </p>
        </div>
      </section>

      {/* Main content with sidebar for ads */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Results Grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DRAW_TIMES.map(t => (
                  <Card key={t} className="gradient-card border-border/50 animate-pulse h-64" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DRAW_TIMES.map((time, i) => (
                  <>
                    <DrawCard key={time} time={time} result={resultsByTime.get(time)} />
                    {/* Ad between results every 2 cards on mobile */}
                    {i === 1 && (
                      <div key="ad-mid-1" className="md:col-span-2">
                        <SponsorSlot position="between_results" />
                      </div>
                    )}
                    {i === 3 && (
                      <div key="ad-mid-2" className="md:col-span-2">
                        <SponsorSlot position="between_results" />
                      </div>
                    )}
                  </>
                ))}
              </div>
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
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Jogos Online — Resultados do Jogo do Bicho PT-Rio</p>
        </div>
      </footer>
    </div>
  );
}
