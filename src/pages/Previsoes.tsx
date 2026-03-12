import { useState } from 'react';
import { usePredictions } from '@/hooks/usePredictions';
import type { BichoPrediction } from '@/hooks/usePredictions';
import { BICHOS } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import {
  Trophy, ArrowLeft, Brain, TrendingUp, TrendingDown, Flame, Snowflake,
  Loader2, RefreshCw, Target, Zap, BarChart3, AlertTriangle, MapPin,
} from 'lucide-react';

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: 'Alta', className: 'bg-primary/20 text-primary border-primary/30' },
    medium: { label: 'Média', className: 'bg-accent/20 text-accent border-accent/30' },
    low: { label: 'Baixa', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  const { label, className } = map[level] || map.medium;
  return <Badge className={className}>Confiança: {label}</Badge>;
}

function PredictionCard({ prediction, rank }: { prediction: BichoPrediction; rank: number }) {
  const bicho = BICHOS.find(b => b.group === prediction.group);
  const isTop3 = rank <= 3;

  return (
    <Card className={`gradient-card border-border/50 ${isTop3 ? 'ring-1 ring-primary/30' : ''}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
            rank === 2 ? 'bg-gray-400/20 text-gray-300' :
            rank === 3 ? 'bg-amber-600/20 text-amber-500' :
            'bg-muted text-muted-foreground'
          }`}>
            {rank}
          </div>
          <span className="text-2xl">{bicho?.emoji || prediction.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold">
                G{String(prediction.group).padStart(2, '0')} — {prediction.name}
              </span>
              {isTop3 && <Flame className="h-4 w-4 text-accent" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{prediction.reason}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-display font-bold text-lg text-primary">{prediction.probability}%</span>
            <Progress value={prediction.probability} className="w-16 h-1.5 mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsGrid({ stats }: { stats: any[] }) {
  const sorted = [...stats].sort((a, b) => b.weightedScore - a.weightedScore);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card className="gradient-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <Trophy className="h-4 w-4" /> Top 10 — Pontuação Ponderada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.slice(0, 10).map((s, i) => (
            <div key={s.group} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs text-muted-foreground font-bold">{i + 1}.</span>
              <span className="text-lg">{s.emoji}</span>
              <span className="flex-1 font-medium">{s.name}</span>
              <Badge variant="secondary" className="font-mono text-xs">{s.weightedScore}pts</Badge>
              {s.trend === 'hot' && <Flame className="h-3 w-3 text-destructive" />}
              {s.trend === 'cold' && <Snowflake className="h-3 w-3 text-blue-400" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gradient-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Mais Atrasados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...stats].sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo).slice(0, 10).map((s, i) => (
            <div key={s.group} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs text-muted-foreground font-bold">{i + 1}.</span>
              <span className="text-lg">{s.emoji}</span>
              <span className="flex-1 font-medium">{s.name}</span>
              <Badge variant="secondary" className="font-mono text-xs text-destructive">{s.lastSeenDrawsAgo} sorteios</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PredictionContent({ lottery }: { lottery: 'rio' | 'capital' }) {
  const { data, isLoading, error, refetch, isFetching } = usePredictions(lottery);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="font-display font-bold text-lg">Analisando dados históricos...</p>
        <p className="text-sm mt-1">A IA está calculando probabilidades</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="gradient-card border-destructive/30">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="font-bold text-destructive mb-1">Erro na análise</p>
          <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const predictions = data.ai_predictions?.predictions || [];
  const analysis = data.ai_predictions?.analysis || '';
  const milhares = data.ai_predictions?.suggested_milhares || [];
  const confidence = data.ai_predictions?.confidence || 'medium';
  const hotPicks = data.ai_predictions?.hot_picks || [];
  const coldPicks = data.ai_predictions?.cold_picks || [];

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {data.total_draws_analyzed} sorteios analisados
        </Badge>
        <Badge variant="secondary">
          {data.date_range.from.split('-').reverse().join('/')} — {data.date_range.to.split('-').reverse().join('/')}
        </Badge>
        <ConfidenceBadge level={confidence} />
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Recalcular</span>
        </Button>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <Card className="gradient-card border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Análise da IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{analysis}</p>
          </CardContent>
        </Card>
      )}

      {/* Predictions ranking */}
      <div>
        <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" /> Ranking de Probabilidades
        </h3>
        <div className="space-y-2">
          {predictions.slice(0, 10).map((p, i) => (
            <PredictionCard key={p.group} prediction={p} rank={i + 1} />
          ))}
        </div>
      </div>

      {/* Hot & Cold + Milhares */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Flame className="h-4 w-4" /> Quentes 🔥
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotPicks.map(g => {
              const b = BICHOS.find(b => b.group === g);
              return b ? (
                <div key={g} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{b.emoji}</span>
                  <span className="font-medium">{b.name}</span>
                  <TrendingUp className="h-3 w-3 text-destructive ml-auto" />
                </div>
              ) : null;
            })}
          </CardContent>
        </Card>

        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <Snowflake className="h-4 w-4" /> Frios ❄️
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {coldPicks.map(g => {
              const b = BICHOS.find(b => b.group === g);
              return b ? (
                <div key={g} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{b.emoji}</span>
                  <span className="font-medium">{b.name}</span>
                  <TrendingDown className="h-3 w-3 text-blue-400 ml-auto" />
                </div>
              ) : null;
            })}
          </CardContent>
        </Card>

        <Card className="gradient-card border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-accent">
              <Zap className="h-4 w-4" /> Milhares Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {milhares.map((m, i) => (
              <div key={i} className="font-mono font-bold text-lg text-accent tracking-widest">
                {m}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Full stats */}
      <div>
        <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-accent" /> Estatísticas Completas
        </h3>
        <StatsGrid stats={data.stats} />
      </div>

      {/* Disclaimer */}
      <Card className="border-muted">
        <CardContent className="py-3 text-center">
          <p className="text-xs text-muted-foreground">
            ⚠️ As previsões são baseadas em análise estatística de dados históricos e NÃO garantem resultados.
            Use com responsabilidade. Jogo é entretenimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Previsoes() {
  const [lottery, setLottery] = useState<'rio' | 'capital'>('rio');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="font-display text-xl font-bold tracking-tight">Jogos Online</h1>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-7 w-7 text-primary" />
          <h2 className="font-display text-2xl font-bold">Previsões com IA</h2>
        </div>

        <Tabs value={lottery} onValueChange={v => setLottery(v as 'rio' | 'capital')} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="rio" className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> PT-Rio
            </TabsTrigger>
            <TabsTrigger value="capital" className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Capital
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rio">
            <PredictionContent lottery="rio" />
          </TabsContent>
          <TabsContent value="capital">
            <PredictionContent lottery="capital" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
