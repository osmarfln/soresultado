import React, { useState, useEffect, useMemo } from 'react';
import { DRAW_TIMES, DRAW_TIME_LABELS, DRAW_TIME_HOURS, DRAW_TIME_PERIODS, getBichoByGroup, getTodayDateString, formatDrawDate } from '@/lib/bichos';
import { CAPITAL_DRAW_TIMES, CAPITAL_DRAW_TIME_LABELS, CAPITAL_DRAW_TIME_HOURS, CAPITAL_SECTION_LABEL, getCapitalTimesForWeekday } from '@/lib/capital';
import { SP_DRAW_TIMES, SP_DRAW_TIME_LABELS, SP_DRAW_TIME_HOURS } from '@/lib/sp';
import { getAllNextDraws, getSaoPauloClock, getFederalScheduleRules, isFederalDrawDay } from '@/lib/drawSchedule';
import { useTodayResults } from '@/hooks/useResults';
import { useTodayCapitalResults } from '@/hooks/useCapitalResults';
import { useTodaySpResults } from '@/hooks/useSpResults';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import type { CapitalResult } from '@/hooks/useCapitalResults';
import type { SpResult } from '@/hooks/useSpResults';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { SponsorSlot } from '@/components/SponsorSlot';
import { Clock, Calendar, Shield, RefreshCw, Loader2, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { PWAUpdateNotice } from '@/components/PWAUpdateNotice';
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
const LOTTERY_THEME: Record<LotteryKey, { accent: string; dot: string; card: string; panel: string }> = {
  RIO: { accent: 'text-lottery-rio', dot: 'bg-lottery-rio', card: 'result-card-rio', panel: 'result-panel-rio' },
  CAPITAL: { accent: 'text-lottery-capital', dot: 'bg-lottery-capital', card: 'result-card-capital', panel: 'result-panel-capital' },
  SP: { accent: 'text-lottery-sp', dot: 'bg-lottery-sp', card: 'result-card-sp', panel: 'result-panel-sp' },
  FEDERAL: { accent: 'text-lottery-federal', dot: 'bg-lottery-federal', card: 'result-card-federal', panel: 'result-panel-federal' },
};

// ─────────────────────────── Status Pill ───────────────────────────

function StatusPill({ status, drawDate }: { status: 'completed' | 'live' | 'waiting'; drawDate?: string }) {
  if (status === 'completed') {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const label = drawDate && drawDate !== today
      ? drawDate.split('-').reverse().slice(0, 2).join('/')
      : 'HOJE';
    return <span className="border border-border bg-secondary text-secondary-foreground text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-md">{label}</span>;
  }
  if (status === 'live')
    return <span className="bg-destructive text-destructive-foreground text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-md animate-pulse">AO VIVO</span>;
  return <span className="border border-border bg-muted text-muted-foreground text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-md">EM BREVE</span>;
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
  lottery, timeLabel, result, status, drawDate, featured = false,
}: {
  lottery: LotteryKey;
  timeLabel: string;
  result?: AnyResult;
  status: 'completed' | 'live' | 'waiting';
  drawDate?: string;
  featured?: boolean;
}) {
  const t = LOTTERY_THEME[lottery];
  const prizeRows = result
    ? [1, 2, 3, 4, 5].map((position) => ({
        position,
        milhar: result[`prize_${position}_milhar` as keyof AnyResult] as string,
        group: result[`prize_${position}_group` as keyof AnyResult] as number,
        bicho: result[`prize_${position}_bicho` as keyof AnyResult] as string,
      }))
    : [];
  const firstAnimal = result ? getBichoByGroup(result.prize_1_group) : undefined;

  return (
    <article className={`result-card ${t.card} ${featured ? 'result-card-featured' : ''}`}>
      <div className={`flex ${featured ? 'items-start' : 'items-center'} justify-between gap-3 mb-4`}>
        <h3 className={`${featured ? 'text-sm leading-snug sm:text-xl' : 'text-base sm:text-lg truncate'} font-display font-extrabold text-foreground uppercase min-w-0`}>
          {lottery !== 'CAPITAL' && <span className={`${t.accent} mr-2`}>{lottery}</span>}
          <span>{timeLabel}</span>
        </h3>
        <StatusPill status={status} drawDate={drawDate} />
      </div>

      {result ? (
        <div className={`grid ${featured ? 'grid-cols-[minmax(0,1fr)_132px] sm:grid-cols-[minmax(0,1fr)_190px]' : 'grid-cols-[minmax(0,1fr)_104px] sm:grid-cols-[minmax(0,1fr)_128px]'} gap-3 sm:gap-5`}>
          <div className="flex flex-col justify-center gap-1">
            {prizeRows.map(({ position, milhar, bicho }) => (
              <div key={position} className={`prize-row ${position === 1 ? 'prize-row-first' : ''}`}>
                <span className="w-6 text-[10px] sm:text-xs font-bold text-muted-foreground">{position}º</span>
                <span className={`${position === 1 ? 'text-lg sm:text-xl text-foreground' : 'text-base sm:text-lg text-secondary-foreground'} min-w-[58px] font-mono font-black tabular-nums`}>{milhar}</span>
                <span className="min-w-0 flex-1 truncate text-right text-[9px] sm:text-[10px] font-extrabold text-muted-foreground uppercase">{bicho}</span>
              </div>
            ))}
          </div>

          <div className={`result-animal-panel ${t.panel}`}>
            <span className={`${featured ? 'text-5xl' : 'text-4xl'} leading-none result-animal`} aria-hidden="true">{firstAnimal?.emoji ?? '★'}</span>
            <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Grupo</span>
            <strong className={`${featured ? 'text-5xl' : 'text-3xl sm:text-4xl'} font-display font-black leading-none ${t.accent}`}>
              {String(result.prize_1_group).padStart(2, '0')}
            </strong>
            <span className="max-w-full truncate text-[10px] sm:text-xs font-extrabold text-foreground uppercase">{result.prize_1_bicho}</span>
          </div>
        </div>
      ) : (
        <div className="min-h-[154px] flex flex-col items-center justify-center gap-2">
          <Clock className={`h-7 w-7 ${t.accent} animate-pulse`} />
          <p className={`text-xs font-extrabold uppercase ${t.accent} animate-pulse`}>Resultado em breve</p>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">aguardando…</p>
        </div>
      )}
    </article>
  );
}

// ─────────────────────────── Draw Card Skeleton ───────────────────────────

function DrawCardSkeleton() {
  return (
    <div className="result-card animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-5 w-16 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-3 min-h-[154px]">
        <div className="space-y-2 py-1">
          {[1, 2, 3, 4, 5].map((position) => <div key={position} className="h-6 bg-muted rounded" />)}
        </div>
        <div className="bg-muted rounded-xl" />
      </div>
    </div>
  );
}


// ─────────────────────────── Section Header ───────────────────────────

function SectionHeader({ lottery, count }: { lottery: LotteryKey; count: number }) {
  const t = LOTTERY_THEME[lottery];
  const title = lottery === 'CAPITAL' ? CAPITAL_SECTION_LABEL : lottery;
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`h-7 w-1 rounded-full ${t.dot}`} />
      <h3 className={`font-display text-xl sm:text-2xl font-extrabold ${t.accent}`}>
        {title}
      </h3>
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground font-bold uppercase">
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

  // Teleprompter ÚNICO: apenas informação dos próximos horários (sem resultados).
  // Durante o dia: próximos horários de HOJE seguindo o cronograma.
  // À noite (quando os sorteios do dia acabam): PRIMEIROS horários de AMANHÃ —
  // getAllNextDraws já retorna o PRIMEIRO sorteio de amanhã de cada loteria,
  // respeitando o dia da semana (ex.: domingo → Federal 11:00, Rio PT 14:20/PTV 16:20;
  // dias úteis → SP 08:20, Rio PPT 09:00, LCAP 09:00).
  const items = useMemo(() => {
    void tick;
    const clock = getSaoPauloClock();
    const tomorrowWeekday = (clock.weekday + 1) % 7;
    return getAllNextDraws().filter((it) => {
      // Federal só aparece quando o sorteio é HOJE ou AMANHÃ (nunca dias à frente)
      if (it.lottery === 'FEDERAL') {
        const isToday = it.dayLabel === 'hoje' && it.countdownSeconds < 86400;
        const drawDay = isToday ? clock.weekday : tomorrowWeekday;
        if (!isFederalDrawDay(drawDay)) return false;
        if (!isToday && it.dayLabel !== 'amanhã') return false;
      }
      return true;
    });
  }, [tick]);

  const track = [...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden bg-slate-950/70 border-y border-slate-800/70 py-2.5">
      <div className="flex gap-10 whitespace-nowrap animate-[marquee_16s_linear_infinite] md:animate-[marquee_22s_linear_infinite] will-change-transform">
        {track.map((it, i) => {
          const t = LOTTERY_THEME[it.lottery];
          const period = it.lottery === 'RIO' ? DRAW_TIME_PERIODS[it.key] : undefined;
          return (
            <div key={i} className="flex items-center gap-2.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot} animate-pulse`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Próximo</span>
              {it.lottery !== 'CAPITAL' && <span className={`text-sm font-black ${t.accent}`}>{it.lottery}</span>}
              <span className="text-xs text-slate-400 font-semibold">
                {it.label}{period ? ` · ${period}` : ''}{it.dayLabel === 'amanhã' ? ' · amanhã' : ''}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-sm text-white font-bold font-mono">sai {it.extractionLabel}</span>
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
  const { user } = useAuth();
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
    <div className="min-h-screen bg-background text-foreground font-body">
      
      <PWAUpdateNotice />
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
               <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
                 <DrawCard
                  lottery="FEDERAL"
                  timeLabel={`${diaLabel} ${hhmm} · ${dataBR}${numero}${suffix}`}
                  result={federalResult as unknown as AnyResult}
                  status="completed"
                  drawDate={federalResult.draw_date}
                   featured
                />
              </div>
            </section>
          );
        })()}

        {federalResult && <SponsorSlot position="between_results" />}

        {/* RIO — quadro completo de horários (domingos apenas PT 14h e PTV 16h; quartas sem PTN 18h) */}
        {(() => {
          const rioWeekday = getSaoPauloClock().weekday;
          const isSunday = rioWeekday === 0;
          const rioTimes = isSunday
            ? DRAW_TIMES.filter((t) => t === 'PT' || t === 'PTV')
            : rioWeekday === 3
              ? DRAW_TIMES.filter((t) => t !== 'PTN')
              : DRAW_TIMES;
          return (
            <section>
              <SectionHeader lottery="RIO" count={rioTimes.length} />
              {isLoading ? (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
                  {rioTimes.slice(0, 6).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
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
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
                  {capitalTimes.slice(0, 6).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
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
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
                  {spTimes.slice(0, 4).map(t => <DrawCardSkeleton key={t} />)}
                </div>
              ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 auto-rows-fr">
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



        <div className="space-y-3">
          <SponsorSlot position="sidebar" />
          <SponsorSlot position="sidebar" />
        </div>

      </main>

      <div className="container mx-auto px-4 pb-3">
        <SponsorSlot position="footer" />
      </div>

      <footer className="border-t border-slate-800/60 py-5 bg-[#0a0c10]">
        <div className="container mx-auto px-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 text-[11px] text-primary/80">
            <Bot className="h-4 w-4 animate-pulse" />
            <span>Resultados atualizados em tempo real, sem intervenção humana — 100% via robô IA</span>
          </div>
          <p className="text-[11px] text-primary/90 text-center max-w-2xl mx-auto leading-relaxed">
            Não temos ligação com nenhuma banca de jogo do bicho e não possuímos patrocínio de bancas ou casas de apostas (bets).
            Somos uma plataforma independente que presta apenas informação — os resultados exibidos são coletados de outros links e sites públicos.
            O jogo do bicho é uma tradição popular no Brasil.
          </p>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-600">© {new Date().getFullYear()} Só Resultados</p>
            <div className="flex items-center gap-2">
              <Link to="/historico" className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded-md transition-colors hover:bg-slate-800/60 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Histórico
              </Link>
              <Link to={user ? '/admin' : '/login'} className="text-[11px] text-slate-500 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-800/60">
                <Shield className="h-3 w-3" />
                Admin
              </Link>
            </div>
          </div>
        </div>

      </footer>
    </div>
  );
}
