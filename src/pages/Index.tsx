import React, { useState, useEffect, useMemo } from 'react';
import logoImg from '@/assets/logo.png';
import { DRAW_TIMES, DRAW_TIME_LABELS, DRAW_TIME_HOURS, getBichoByGroup, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS, CAPITAL_DRAW_TIME_HOURS } from '@/lib/capital';
import { SP_DRAW_TIMES, SP_DRAW_TIME_LABELS, SP_DRAW_TIME_HOURS } from '@/lib/sp';
import { formatCountdown, getAllNextDraws, getSaoPauloClock, getFederalScheduleRules, isFederalDrawDay } from '@/lib/drawSchedule';
import { useTodayResults } from '@/hooks/useResults';
import { useTodayCapitalResults } from '@/hooks/useCapitalResults';
import { useTodaySpResults } from '@/hooks/useSpResults';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import type { CapitalResult } from '@/hooks/useCapitalResults';
import type { SpResult } from '@/hooks/useSpResults';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SponsorSlot } from '@/components/SponsorSlot';
import { Clock, Trophy, Calendar, Shield, RefreshCw, Loader2, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TickerBanner } from '@/components/TickerBanner';
import { PWAUpdateNotice } from '@/components/PWAUpdateNotice';
import { LiveCountdownClock } from '@/components/LiveCountdownClock';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import type { DrawResult } from '@/hooks/useResults';

// ─────────────────────────── Helpers ───────────────────────────

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

// Lottery visual identity
type LotteryKey = 'RIO' | 'CAPITAL' | 'SP' | 'FEDERAL';
const LOTTERY_THEME: Record<LotteryKey, { header: string; accent: string; glow: string; dot: string; pill: string }> = {
  RIO:     { header: 'from-emerald-600 to-teal-700',   accent: 'text-emerald-400', glow: 'drop-shadow-[0_0_15px_rgba(52,211,153,0.55)]', dot: 'bg-emerald-400', pill: 'bg-emerald-400 text-slate-950' },
  CAPITAL: { header: 'from-amber-500 to-orange-600',   accent: 'text-amber-400',   glow: 'drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]',  dot: 'bg-amber-400',   pill: 'bg-amber-400 text-slate-950' },
  SP:      { header: 'from-red-600 to-rose-700', accent: 'text-red-400', glow: 'drop-shadow-[0_0_15px_rgba(248,113,113,0.6)]',dot: 'bg-red-500', pill: 'bg-red-500 text-white' },
  FEDERAL: { header: 'from-yellow-500 to-amber-600',   accent: 'text-yellow-300',  glow: 'drop-shadow-[0_0_18px_rgba(253,224,71,0.65)]', dot: 'bg-yellow-400',  pill: 'bg-yellow-400 text-slate-950' },
};

// ─────────────────────────── Status Pill ───────────────────────────

function StatusPill({ status, drawDate }: { status: 'completed' | 'live' | 'waiting'; drawDate?: string }) {
  if (status === 'completed') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const label = drawDate && drawDate !== today
      ? drawDate.split('-').reverse().slice(0, 2).join('/')
      : 'HOJE';
    return <span className="bg-white/15 text-white text-[10px] font-black tracking-widest px-2 py-1 rounded-full backdrop-blur-md">{label}</span>;
  }
  if (status === 'live')
    return <span className="bg-red-500/90 text-white text-[10px] font-black tracking-widest px-2 py-1 rounded-full animate-pulse">AO VIVO</span>;
  return <span className="bg-black/25 text-white/80 text-[10px] font-black tracking-widest px-2 py-1 rounded-full backdrop-blur-md">EM BREVE</span>;
}

// ─────────────────────────── Draw Card ───────────────────────────

interface AnyResult {
  prize_1_milhar: string; prize_1_group: number; prize_1_bicho: string;
  prize_2_milhar: string; prize_2_group: number; prize_2_bicho: string;
  prize_3_milhar: string; prize_3_group: number; prize_3_bicho: string;
  prize_4_milhar: string; prize_4_group: number; prize_4_bicho: string;
  prize_5_milhar: string; prize_5_group: number; prize_5_bicho: string;
}

function DrawCard({
  lottery, timeLabel, result, status, drawDate,
}: {
  lottery: LotteryKey;
  timeLabel: string;
  result?: AnyResult;
  status: 'completed' | 'live' | 'waiting';
  drawDate?: string;
}) {
  const t = LOTTERY_THEME[lottery];
  const bebas = { fontFamily: "'Bebas Neue', 'Outfit', sans-serif" } as React.CSSProperties;

  return (
    <Card className="bg-[#141820] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl transition-transform hover:scale-[1.01] hover:border-slate-700 h-full flex flex-col">
      {/* Header */}
      <div className={`bg-gradient-to-r ${t.header} px-4 py-2.5 flex justify-between items-center gap-2`}>
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2 min-w-0">
          {lottery !== 'CAPITAL' && <span className="truncate">{lottery}</span>}
          <span className="text-xs sm:text-sm font-black tracking-wider text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{timeLabel}</span>
        </h3>
        <StatusPill status={status} drawDate={drawDate} />
      </div>

      <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-[220px]">

        {result ? (
          <>
            {/* 1st Prize Highlight */}
            <div className="relative mb-4 p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-inner min-h-[68px] flex items-center">
              <div className={`absolute -top-2.5 left-4 text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider ${t.pill}`}>1º PRÊMIO</div>
              <div className="flex justify-between items-center gap-3 w-full">
                <div className="text-xl sm:text-2xl font-black text-white leading-none tracking-tighter tabular-nums" style={bebas}>
                  {result.prize_1_milhar}
                </div>
                <div className="text-right min-w-0 flex-1">
                  <div className={`text-xs sm:text-sm font-extrabold uppercase leading-tight truncate ${t.accent} ${t.glow} animate-pulse`}>
                    {result.prize_1_bicho}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5 truncate">
                    Grupo {String(result.prize_1_group).padStart(2, '0')} {getBichoByGroup(result.prize_1_group)?.emoji ?? ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Other Prizes 2x2 */}
            <div className="grid grid-cols-2 gap-2 mt-auto">
              {[2, 3, 4, 5].map((pos) => {
                const milhar = (result as any)[`prize_${pos}_milhar`] as string;
                const group = (result as any)[`prize_${pos}_group`] as number;
                const bicho = (result as any)[`prize_${pos}_bicho`] as string;
                return (
                  <div key={pos} className="relative flex flex-col gap-0.5 rounded-lg bg-slate-900/70 border border-slate-800 px-2.5 py-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-black tracking-wider ${t.accent}`}>{pos}º</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">G{String(group).padStart(2, '0')}</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-white font-mono tabular-nums leading-none tracking-tight" style={bebas}>{milhar}</span>
                    <span className="text-[11px] text-slate-300 uppercase font-bold truncate">
                      {bicho}
                    </span>
                  </div>
                );
              })}
            </div>

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
            <Clock className={`h-8 w-8 ${t.accent} opacity-70 animate-pulse`} />
            <p className={`text-sm font-black uppercase tracking-wider ${t.accent} animate-pulse`}>
              Resultado em breve
            </p>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest animate-[pulse_1.2s_ease-in-out_infinite]">
              aguardando…
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────── Draw Card Skeleton ───────────────────────────

function DrawCardSkeleton() {
  return (
    <Card className="bg-[#141820] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl h-full flex flex-col">
      <div className="bg-slate-800/60 px-4 py-2.5 flex justify-between items-center gap-2">
        <div className="h-4 w-32 bg-slate-700/60 rounded animate-pulse" />
        <div className="h-5 w-16 bg-slate-700/60 rounded-full animate-pulse" />
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-[220px]">
        <div className="relative mb-4 p-2.5 sm:p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 min-h-[68px] flex items-center animate-pulse">
          <div className="flex justify-between items-center gap-3 w-full">
            <div className="h-7 w-20 bg-slate-700/70 rounded" />
            <div className="text-right space-y-1.5 flex-1">
              <div className="h-3.5 w-20 bg-slate-700/70 rounded ml-auto" />
              <div className="h-2.5 w-16 bg-slate-700/50 rounded ml-auto" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-auto">
          {[2, 3, 4, 5].map((pos) => (
            <div key={pos} className="flex justify-between items-center gap-2 border-b border-slate-800/70 pb-1.5 animate-pulse">
              <div className="h-3 w-3 bg-slate-700/60 rounded" />
              <div className="h-4 w-14 bg-slate-700/60 rounded" />
              <div className="h-3 w-12 bg-slate-700/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}


// ─────────────────────────── Section Header ───────────────────────────

function SectionHeader({ lottery, count }: { lottery: LotteryKey; count: number }) {
  const t = LOTTERY_THEME[lottery];
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`h-8 w-1.5 rounded-full ${t.dot}`} />
      <h3 className={`font-display text-2xl sm:text-3xl font-black tracking-tight ${t.accent} ${t.glow}`}>
        {lottery}
      </h3>
      <div className={`flex-1 h-px bg-gradient-to-r ${t.header} opacity-40`} />
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        {count} sorteio{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ─────────────────────────── Next Draws Carousel ───────────────────────────

function NextDrawsCarousel() {
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    let timeoutId: number;

    const schedulePreciseTick = () => {
      const delay = 1000 - (Date.now() % 1000) + 25;
      timeoutId = window.setTimeout(() => {
        setTick(Date.now());
        schedulePreciseTick();
      }, delay);
    };

    schedulePreciseTick();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const items = useMemo(() => {
    void tick;
    const weekday = getSaoPauloClock().weekday;
    const showFederal = isFederalDrawDay(weekday);
    return getAllNextDraws().filter((it) => it.lottery !== 'FEDERAL' || showFederal);
  }, [tick]);


  const track = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden bg-slate-950/70 border-y border-slate-800/70 py-2.5">
      <div className="flex gap-10 whitespace-nowrap animate-[marquee_12s_linear_infinite] md:animate-[marquee_16s_linear_infinite] will-change-transform">
        {track.map((it, i) => {
          const t = LOTTERY_THEME[it.lottery];
          return (
            <div key={i} className="flex items-center gap-2.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Próximo</span>
              <span className={`text-sm font-black ${t.accent}`}>{it.lottery}</span>
              <span className="text-xs text-slate-400 font-semibold">{it.dayLabel === 'amanhã' ? `${it.label} amanhã` : it.label}</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-sm text-white font-bold font-mono">sai {it.extractionLabel}</span>
              {it.countdownSeconds > 0 && it.countdownSeconds <= 30 * 60 && (
                <span className="text-[11px] font-mono font-bold text-amber-400 animate-pulse">
                  faltam {Math.max(1, Math.ceil(it.countdownSeconds / 60))} min
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─────────────────────────── Page ───────────────────────────

export default function Index() {
  useTrackVisit('/');
  useRealtimeResults();
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
      toast({
        title: '✅ Atualizado!',
        description: `Rio: ${rioCount} | Capital: ${capCount} | SP: ${spCount} resultado(s)`,
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
  const spByTime = new Map<string, SpResult>();
  spResults?.forEach(r => spByTime.set(r.draw_time, r));

  const displayDate = results && results.length > 0
    ? results[0].draw_date
    : capitalResults && capitalResults.length > 0
      ? capitalResults[0].draw_date
      : today;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <TickerBanner />
      <PWAUpdateNotice />
      <LiveCountdownClock />

      {/* Header */}
      <header className="border-b border-slate-800/60 bg-[#0a0c10]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logoImg} alt="Só Resultados" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link to="/historico" className="text-xs font-medium text-slate-400 hover:text-white px-2 py-1.5 rounded-md transition-colors hover:bg-slate-800/60 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
            <Link to={user ? '/admin' : '/login'} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1.5">
              <Shield className="h-3.5 w-3.5" />
            </Link>
            {isAdmin && (
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px] px-1.5 py-0">
                Admin
              </Badge>
            )}
          </nav>
        </div>
      </header>

      {/* Next Draws Carousel */}
      <NextDrawsCarousel />

      <SponsorSlot position="header" className="container mx-auto px-4 pt-3" />

      {/* Hero */}
      <section className="border-b border-slate-800/40">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-[0.25em] mb-1">
            {formatDrawDate(displayDate)}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-black mb-3 text-white tracking-tight">
            Só <span className="text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.4)]">Resultados</span>
          </h2>

          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="font-mono text-base sm:text-lg font-bold text-white">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="h-9 text-sm border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          {(() => {
            const lastUpdate = Math.max(rioUpdatedAt || 0, capUpdatedAt || 0, spUpdatedAt || 0);
            if (!lastUpdate) return null;
            const diffMs = currentTime.getTime() - lastUpdate;
            const diffMin = Math.floor(diffMs / 60000);
            const label = diffMin < 1 ? 'agora' : diffMin === 1 ? 'há 1 min' : `há ${diffMin} min`;
            return <p className="text-[11px] text-slate-500 mt-2 tracking-wider uppercase">Atualizado {label}</p>;
          })()}
        </div>
      </section>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-8">

        {/* FEDERAL — sempre em destaque no topo (último resultado disponível) */}
        {federalResult && (() => {
          const [yy, mm, dd] = federalResult.draw_date.split('-').map(Number);
          const federalWeekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
          const rule = getFederalScheduleRules().find((r) => r.weekday === federalWeekday);
          const WEEKDAY_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
          const diaLabel = WEEKDAY_PT[federalWeekday];
          const hhmm = rule
            ? `${rule.drawHour} horas`
            : '20 horas';
          const dataBR = federalResult.draw_date.split('-').reverse().join('/');
          const isToday = federalResult.draw_date === today;
          const numero = federalResult.draw_number ? ` · Nº ${federalResult.draw_number}` : '';
          const suffix = isToday ? ' · hoje' : '';
          return (
            <section>
              <SectionHeader lottery="FEDERAL" count={1} />
              <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
                <DrawCard
                  lottery="FEDERAL"
                  timeLabel={`${diaLabel} ${hhmm} · ${dataBR}${numero}${suffix}`}
                  result={federalResult as unknown as AnyResult}
                  status="completed"
                  drawDate={federalResult.draw_date}
                />
              </div>
            </section>
          );
        })()}

        {federalResult && <SponsorSlot position="between_results" />}

        {/* RIO — quadro completo de horários (aos domingos apenas PT 14h e PTV 16h) */}
        {(() => {
          const isSunday = getSaoPauloClock().weekday === 0;
          const rioTimes = isSunday
            ? DRAW_TIMES.filter((t) => t === 'PT' || t === 'PTV')
            : DRAW_TIMES;
          return (
            <section>
              <SectionHeader lottery="RIO" count={rioTimes.length} />
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {rioTimes.slice(0, 6).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {rioTimes.map((time) => (
                    <DrawCard
                      key={time}
                      lottery="RIO"
                      timeLabel={DRAW_TIME_LABELS[time]}
                      result={resultsByTime.get(time)}
                      status={resultsByTime.get(time) ? 'completed' : getDrawStatus(time, DRAW_TIME_HOURS)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })()}


        <SponsorSlot position="between_results" />

        {/* CAPITAL — quadro completo de horários */}
        {(() => {
          const capitalTimes = getCapitalTimesForWeekday(getSaoPauloClock().weekday);

          return (
            <section>
              <SectionHeader lottery="CAPITAL" count={capitalTimes.length} />
              {capitalLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {capitalTimes.slice(0, 6).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {capitalTimes.map((time) => (
                    <DrawCard
                      key={time}
                      lottery="CAPITAL"
                      timeLabel={CAPITAL_DRAW_TIME_LABELS[time]}
                      result={capitalByTime.get(time)}
                      status={capitalByTime.get(time) ? 'completed' : getDrawStatus(time, CAPITAL_DRAW_TIME_HOURS)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        <SponsorSlot position="between_results" />

        {/* SP — quadro completo de horários */}
        {(() => {
          const isSaturdaySp = getSaoPauloClock().weekday === 6;
          const spTimes = SP_DRAW_TIMES.filter((t) => t !== 'PTNSP_2000' || isSaturdaySp);
          return (
            <section>
              <SectionHeader lottery="SP" count={spTimes.length} />
              {spLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {spTimes.slice(0, 4).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
                  {spTimes.map((time) => (
                    <DrawCard
                      key={time}
                      lottery="SP"
                      timeLabel={SP_DRAW_TIME_LABELS[time]}
                      result={spByTime.get(time)}
                      status={spByTime.get(time) ? 'completed' : getDrawStatus(time, SP_DRAW_TIME_HOURS)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })()}


        {/* Quick Links */}
        <section className="grid grid-cols-1 gap-3">
          <Link to="/historico" className="flex flex-col items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-xl py-3 px-2 hover:bg-slate-800/60 hover:border-slate-700 transition-all group">
            <Calendar className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Histórico</span>
          </Link>
        </section>

        <div className="space-y-3">
          <SponsorSlot position="sidebar" />
          <SponsorSlot position="sidebar" />
        </div>

        <div className="text-center pt-2">
          <p className="text-slate-600 text-[10px] uppercase tracking-[0.25em] font-bold italic">
            Resultados atualizados em tempo real via sistema oficial
          </p>
        </div>
      </main>

      <div className="container mx-auto px-4 pb-3">
        <SponsorSlot position="footer" />
      </div>

      <footer className="border-t border-slate-800/60 py-5 bg-[#0a0c10]">
        <div className="container mx-auto px-4 flex flex-col items-center gap-2">
          <img src={logoImg} alt="Só Resultados" className="h-5 w-auto opacity-50" />
          <div className="flex items-center gap-2 text-[11px] text-primary/80">
            <Bot className="h-4 w-4 animate-pulse" />
            <span>Resultados atualizados em tempo real, sem intervenção humana — 100% via robô IA</span>
          </div>
          <p className="text-[11px] text-slate-600">© {new Date().getFullYear()} Só Resultados</p>
        </div>

      </footer>
    </div>
  );
}
