import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import logoImg from '@/assets/logo.png';
import { usePredictions } from '@/hooks/usePredictions';
import { getTodayDateString, formatDrawDate } from '@/lib/bichos';
import type { BichoPrediction, DezenaDelay } from '@/hooks/usePredictions';
import { BICHOS } from '@/lib/bichos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import {
  Trophy, ArrowLeft, Brain, TrendingUp, TrendingDown, Flame, Snowflake,
  Loader2, RefreshCw, Target, Zap, BarChart3, AlertTriangle, MapPin, Clock, Hash, Calendar, Activity, Terminal
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

function DelayedGroups({ stats }: { stats: any[] }) {
  const sorted = [...stats].sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo).slice(0, 10);
  return (
    <Card className="gradient-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
          <Clock className="h-4 w-4" /> Grupos Mais Atrasados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((s, i) => (
          <div key={s.group} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-xs text-muted-foreground font-bold">{i + 1}.</span>
            <span className="text-lg">{s.emoji}</span>
            <span className="flex-1 font-medium">G{String(s.group).padStart(2, '0')} {s.name}</span>
            <Badge variant="destructive" className="font-mono text-xs">{s.lastSeenDrawsAgo} sorteios</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DelayedDezenas({ dezenas }: { dezenas: DezenaDelay[] }) {
  const rankedDezenas = useMemo(() => {
    return [...dezenas]
      .sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo || a.dezena.localeCompare(b.dezena));
  }, [dezenas]);

  return (
    <Card className="gradient-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-accent">
          <Hash className="h-4 w-4" /> Dezenas Mais Atrasadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rankedDezenas.slice(0, 15).map((d, i) => {
          const bicho = BICHOS.find(b => b.group === d.group);
          return (
            <div key={d.dezena} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs text-muted-foreground font-bold">{i + 1}.</span>
              <span className="font-mono font-bold text-primary w-6">{d.dezena}</span>
              <span className="text-base">{bicho?.emoji}</span>
              <span className="flex-1 text-muted-foreground text-xs">{bicho?.name}</span>
              <Badge variant="secondary" className="font-mono text-xs">{d.lastSeenDrawsAgo} sorteios</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatsGrid({ stats }: { stats: any[] }) {
  const sorted = [...stats].sort((a, b) => b.weightedScore - a.weightedScore);

  return (
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
            {s.trend === 'cold' && <Snowflake className="h-3 w-3 text-primary" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PredictionContent({ lottery }: { lottery: 'rio' | 'capital' | 'federal' | 'sp' }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = usePredictions(lottery);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const handleRecalculate = useCallback(async () => {
    // Remove cached data to force a completely fresh API call
    queryClient.removeQueries({ queryKey: ['predictions', lottery] });
    await refetch();
  }, [queryClient, lottery, refetch]);


  const predictions = data?.ai_predictions?.predictions || [];
  const analysis = data?.ai_predictions?.analysis || '';
  const milhares = data?.ai_predictions?.suggested_milhares || [];
  const centenas = (data as any)?.ai_predictions?.suggested_centenas || [];
  const suggestedDezenas = (data as any)?.ai_predictions?.suggested_dezenas || [];
  const confidence = data?.ai_predictions?.confidence || 'medium';
  const hotPicks = data?.ai_predictions?.hot_picks || [];
  const coldPicks = data?.ai_predictions?.cold_picks || [];
  const dezenasQuentes = (data as any)?.ai_predictions?.hot_dezenas || [];
  const dezenasFrias = (data as any)?.global_delays?.dezenas?.slice(0, 10).map((d: any) => d.dezena) || [];

  const isDataComplete = useMemo(() => {
    return (
      predictions.length > 0 &&
      milhares.length > 0 &&
      centenas.length > 0 &&
      suggestedDezenas.length > 0 &&
      hotPicks.length > 0 &&
      dezenasQuentes.length > 0
    );
  }, [predictions, milhares, centenas, suggestedDezenas, hotPicks, dezenasQuentes]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="font-display font-bold text-lg">Analisando dados históricos...</p>
        <p className="text-sm mt-1">A IA está processando os dados históricos dos últimos 10 dias</p>
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
          <Button onClick={handleRecalculate} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;




  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          <Calendar className="h-3 w-3 mr-1" /> Últimos 10 Dias
        </Badge>
        <Badge variant="outline">
          {data.total_draws_analyzed} sorteios da {(data as any).lottery === 'rio' ? 'PT-Rio' : (data as any).lottery === 'sp' ? 'PT-SP' : (data as any).lottery === 'capital' ? 'Capital' : 'Federal'}
        </Badge>
        <Badge variant="outline" className="bg-accent/5">
          {data.total_draws_global} sorteios globais somados
        </Badge>
        {data.date_range?.from && data.date_range?.to && (
          <Badge variant="secondary">
            {data.date_range.from.split('-').reverse().join('/')} — {data.date_range.to.split('-').reverse().join('/')}
          </Badge>
        )}
        <ConfidenceBadge level={confidence} />
        <div className="flex items-center gap-2 ml-auto">
          <Button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary"
          >
            <Terminal className="h-4 w-4 mr-1.5" />
            Diagnóstico
          </Button>
          <Button
            onClick={handleRecalculate}
            disabled={isFetching}
            variant="outline"
            size="sm"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">Recalcular</span>
          </Button>
        </div>
      </div>

      {showDiagnostic && (
        <Card className="bg-black text-green-500 font-mono text-[10px] p-4 border-green-900/50 overflow-auto max-h-[400px]">
          <div className="flex justify-between items-center mb-2 border-b border-green-900/30 pb-1">
            <span className="font-bold">MODO DIAGNÓSTICO (PAYLOAD BRUTO DA IA)</span>
            <span className={isDataComplete ? "text-green-400" : "text-red-400"}>
              {isDataComplete ? "[COMPLETO]" : "[INCOMPLETO - AGUARDANDO DADOS]"}
            </span>
          </div>
          <pre>{JSON.stringify(data.ai_predictions, null, 2)}</pre>
        </Card>
      )}

      {!isDataComplete && !isFetching && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">Os dados da IA estão sendo processados ou chegaram incompletos. Tente recalcular para obter a análise completa.</p>
          </CardContent>
        </Card>
      )}


      {/* Atrasos Globais */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Clock className="h-4 w-4" /> Dezenas Mais Atrasadas (Global)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(data as any).global_delays?.dezenas?.slice(0, 10).map((d: any) => (
                <div key={d.dezena} className="flex flex-col items-center">
                  <Badge variant="outline" className="font-mono text-destructive border-destructive/30 px-2 py-0.5">
                    {d.dezena}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground mt-1">{d.delay}j</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Grupos Quentes */}
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Flame className="h-4 w-4" /> Grupos Quentes 🔥
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotPicks.length > 0 ? (
              hotPicks.map(g => {
                const b = BICHOS.find(b => b.group === g);
                return b ? (
                  <div key={g} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{b.emoji}</span>
                    <span className="font-medium">G{String(b.group).padStart(2, '0')} {b.name}</span>
                    <TrendingUp className="h-3 w-3 text-destructive ml-auto" />
                  </div>
                ) : null;
              })
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum grupo quente identificado.</p>
            )}
          </CardContent>
        </Card>

        {/* Dezenas Quentes */}
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-accent">
              <Flame className="h-4 w-4" /> Dezenas Quentes 🔥
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {dezenasQuentes.length > 0 ? (
                dezenasQuentes.map((dz: string) => (
                  <Badge key={dz} variant="secondary" className="font-mono font-bold text-sm bg-accent/20 text-accent border-accent/30">
                    {dz}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">Calculando dezenas...</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dezenas Frias */}
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <Snowflake className="h-4 w-4" /> Dezenas Frias ❄️
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {dezenasFrias.length > 0 ? (
                dezenasFrias.map((dz: string) => (
                  <Badge key={dz} variant="secondary" className="font-mono font-bold text-sm bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {dz}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">Calculando dezenas...</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grupos Frios */}
        <Card className="gradient-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <Snowflake className="h-4 w-4" /> Grupos Frios ❄️
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {coldPicks.length > 0 ? (
              coldPicks.map(g => {
                const b = BICHOS.find(b => b.group === g);
                return b ? (
                  <div key={g} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{b.emoji}</span>
                    <span className="font-medium">G{String(b.group).padStart(2, '0')} {b.name}</span>
                    <TrendingDown className="h-3 w-3 text-blue-400 ml-auto" />
                  </div>
                ) : null;
              })
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum grupo frio identificado.</p>
            )}
          </CardContent>
        </Card>

        {/* Dezenas Sugeridas */}
        <Card className="gradient-card border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-accent">
              <Hash className="h-4 w-4" /> Dezenas Sugeridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(data as any).ai_predictions?.suggested_dezenas?.map((dz: string, i: number) => (
                <Badge key={i} variant="outline" className="font-mono font-bold text-lg text-primary border-primary/30 px-3 py-1">
                  {dz}
                </Badge>
              ))}
              {!(data as any).ai_predictions?.suggested_dezenas?.length && <span className="text-xs text-muted-foreground italic">Calculando...</span>}
            </div>
          </CardContent>
        </Card>


        {/* Palpites Sugeridos */}
        <Card className="gradient-card border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-accent">
              <Zap className="h-4 w-4" /> Palpites Sugeridos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Milhares</p>
              <div className="flex flex-wrap gap-2">
                {milhares.length > 0 ? (
                  milhares.map((m, i) => (
                    <Badge key={i} variant="outline" className="font-mono font-bold text-base text-accent border-accent/30 tracking-widest px-2">
                      {m}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">Gerando palpites...</span>
                )}
              </div>
            </div>
            
            {(data as any).ai_predictions?.suggested_centenas && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Centenas</p>
                <div className="flex flex-wrap gap-2">
                  {(data as any).ai_predictions.suggested_centenas.map((c: string, i: number) => (
                    <Badge key={i} variant="outline" className="font-mono font-bold text-base text-primary border-primary/30 tracking-widest px-2">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delay sections */}
      <div>
        <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-destructive" /> Atrasos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DelayedGroups stats={data.stats} />
          <DelayedDezenas dezenas={data.dezena_delays || []} />
        </div>
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
  useTrackVisit('/previsoes');
  const [lottery, setLottery] = useState<'rio' | 'capital' | 'federal' | 'sp'>('rio');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Só Resultados" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-primary" />
            <h2 className="font-display text-2xl font-bold">Previsões com IA</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDrawDate(getTodayDateString())} — Previsões atualizadas para hoje
          </p>
        </div>

        <Tabs value={lottery} onValueChange={v => setLottery(v as 'rio' | 'capital' | 'federal' | 'sp')} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="rio" className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> PT-Rio
            </TabsTrigger>
            <TabsTrigger value="capital" className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Capital
            </TabsTrigger>
            <TabsTrigger value="sp" className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> PT-SP
            </TabsTrigger>
            <TabsTrigger value="federal" className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" /> Federal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rio">
            <PredictionContent lottery="rio" />
          </TabsContent>
          <TabsContent value="capital">
            <PredictionContent lottery="capital" />
          </TabsContent>
          <TabsContent value="sp">
            <PredictionContent lottery="sp" />
          </TabsContent>
          <TabsContent value="federal">
            <PredictionContent lottery="federal" />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
