import { useTicker } from '@/hooks/useTicker';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import { getTodayDateString } from '@/lib/bichos';
import {
  formatExtractionTime,
  getActiveDailySchedule,
  getFederalDrawForWeekday,
  getSaoPauloClock,
  isFederalDrawDay,
  toSeconds,
  formatCountdown,
} from '@/lib/drawSchedule';
import { useDrawEstimates, getEstimatedNextDraws } from '@/hooks/useDrawEstimates';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const JUST_RELEASED_WINDOW_MINUTES = 1;

// Velocidade constante em px/s — acelerada para não ficar lento no celular
const FEDERAL_SPEED_PX_S = 110;
const SPEED_MAP_PX_S: Record<number, number> = { 1: 420, 2: 560, 3: 720, 4: 920 };
const MOBILE_SPEED_MULTIPLIER = 1.45;

function useScrollDuration(dep: unknown, pxPerSecond: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);

  useLayoutEffect(() => {
    const compute = () => {
      const el = trackRef.current;
      if (!el) return;
      // O trilho contém 3x a mensagem; a animação percorre -33.33% (uma cópia).
      const distance = el.scrollWidth / 3;
      if (distance > 0) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const effectiveSpeed = isMobile ? pxPerSecond * MOBILE_SPEED_MULTIPLIER : pxPerSecond;
        setDuration(Math.max(3.2, distance / effectiveSpeed));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [dep, pxPerSecond]);

  return { trackRef, duration };
}

export function TickerBanner() {
  const { data: ticker } = useTicker();
  const { data: federalResult } = useLatestFederalResult();
  const estimates = useDrawEstimates();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    let timeoutId: number;
    const schedulePreciseTick = () => {
      const delay = 1000 - (Date.now() % 1000) + 25;
      timeoutId = window.setTimeout(() => {
        setTick((n) => n + 1);
        schedulePreciseTick();
      }, delay);
    };
    schedulePreciseTick();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const today = getTodayDateString();
  const isFederalToday = !!federalResult && federalResult.draw_date === today;

  const federalMessage = useMemo(() => {
    void tick;
    const clock = getSaoPauloClock();
    if (!isFederalDrawDay(clock.weekday)) return null;

    const RED = '#ff3b3b';
    const GOLD = '#ffcc33';

    const todayFederal = getFederalDrawForWeekday(clock.weekday);
    const federalSecs = todayFederal
      ? toSeconds(todayFederal.extractionHour, todayFederal.extractionMinute)
      : null;
    const alreadyDrawn = federalSecs !== null && clock.totalSeconds >= federalSecs;

    if (alreadyDrawn && isFederalToday && federalResult) {
      const prizes = [
        { pos: '1º', milhar: federalResult.prize_1_milhar, bicho: federalResult.prize_1_bicho },
        { pos: '2º', milhar: federalResult.prize_2_milhar, bicho: federalResult.prize_2_bicho },
        { pos: '3º', milhar: federalResult.prize_3_milhar, bicho: federalResult.prize_3_bicho },
        { pos: '4º', milhar: federalResult.prize_4_milhar, bicho: federalResult.prize_4_bicho },
        { pos: '5º', milhar: federalResult.prize_5_milhar, bicho: federalResult.prize_5_bicho },
      ];
      return (
        <>
          🏆 SAIU O RESULTADO DA <span style={{ color: RED, fontWeight: 900 }}>FEDERAL</span>! Concurso {federalResult.draw_number || ''} —{' '}
          {prizes.map((p, i) => (
            <span key={i}>
              {p.pos}{' '}
              <span style={{ color: GOLD, fontWeight: 900 }}>{p.milhar}</span>{' '}
              <span style={{ color: GOLD }}>({p.bicho})</span>
              {i < prizes.length - 1 ? ' | ' : ' '}
            </span>
          ))}
          🏆
        </>
      );
    }
    if (todayFederal && federalSecs !== null && !alreadyDrawn) {
      // Janela de anúncio: 3h antes do sorteio
      const windowStart = federalSecs - 3 * 3600;
      if (clock.totalSeconds >= windowStart) {
        const timeLabel = formatExtractionTime(todayFederal.extractionHour, todayFederal.extractionMinute);
        return (
          <>
            🎉 HOJE TEM <span style={{ color: RED, fontWeight: 900 }}>FEDERAL</span>! Sorteio às{' '}
            <span style={{ color: GOLD, fontWeight: 900 }}>{timeLabel}</span> — fique ligado no resultado aqui no Só Resultados 🎉
          </>
        );
      }
    }
    return null;
  }, [tick, isFederalToday, federalResult]);

  const justReleasedMessage = useMemo(() => {
    void tick;
    const clock = getSaoPauloClock();
    const windowSec = JUST_RELEASED_WINDOW_MINUTES * 60;
    const activeToday = getActiveDailySchedule(clock.weekday);
    const recent = activeToday.filter((item) => {
      const extSec = toSeconds(item.extractionHour, item.extractionMinute);
      const diff = clock.totalSeconds - extSec;
      return diff >= 0 && diff <= windowSec;
    });
    if (recent.length === 0) return null;
    const parts = recent.map(
      (item) => `✅ SAIU O RESULTADO — ${item.label} (${formatExtractionTime(item.extractionHour, item.extractionMinute)})`,
    );
    return parts.join('   •   ');
  }, [tick]);

  const hasTickerMessage = ticker && ticker.is_active && ticker.message;
  const hasFederalMessage = !!federalMessage;
  const hasJustReleased = !!justReleasedMessage;

  const federalScroll = useScrollDuration(federalMessage, FEDERAL_SPEED_PX_S);
  const tickerSpeedPx = ticker ? SPEED_MAP_PX_S[ticker.speed] || 130 : 130;
  const tickerScroll = useScrollDuration(ticker?.message, tickerSpeedPx);
  const releasedScroll = useScrollDuration(justReleasedMessage, 110);

  if (!hasTickerMessage && !hasFederalMessage && !hasJustReleased) return null;

  return (
    <div className="flex flex-col">
      {hasJustReleased && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{
            background: 'linear-gradient(90deg, #065f46, #10b981, #065f46)',
            color: '#ffffff',
            fontSize: '17px',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          <div
            ref={releasedScroll.trackRef}
            className="inline-block animate-ticker py-2 font-bold"
            style={{
              animationDuration: `${releasedScroll.duration}s`,
              animationDelay: `-${(Date.now() / 1000) % releasedScroll.duration}s`,
            }}
          >
            <span className="px-8">{justReleasedMessage}</span>
            <span className="px-8">{justReleasedMessage}</span>
            <span className="px-8">{justReleasedMessage}</span>
          </div>
        </div>
      )}

      {hasFederalMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{ backgroundColor: '#000000', color: '#ffffff', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <div
            ref={federalScroll.trackRef}
            className="inline-block animate-ticker py-2 font-bold"
            style={{
              animationDuration: `${federalScroll.duration}s`,
              animationDelay: `-${(Date.now() / 1000) % federalScroll.duration}s`,
            }}
          >
            <span className="px-8">{federalMessage}</span>
            <span className="px-8">{federalMessage}</span>
            <span className="px-8">{federalMessage}</span>
          </div>
        </div>
      )}

      {hasTickerMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{
            backgroundColor: ticker!.bg_color,
            color: ticker!.text_color,
            fontSize: ticker!.font_size,
            fontFamily: ticker!.font_family,
          }}
        >
          <div
            ref={tickerScroll.trackRef}
            className="inline-block animate-ticker py-2 font-semibold"
            style={{
              animationDuration: `${tickerScroll.duration}s`,
              animationDelay: `-${(Date.now() / 1000) % tickerScroll.duration}s`,
            }}
          >
            <span className="px-8">{ticker!.message}</span>
            <span className="px-8">{ticker!.message}</span>
            <span className="px-8">{ticker!.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
