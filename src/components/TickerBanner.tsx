import { useTicker } from '@/hooks/useTicker';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import { getTodayDateString } from '@/lib/bichos';
import { getSaoPauloClock, isFederalDrawDay, toSeconds } from '@/lib/drawSchedule';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Velocidade constante em px/s — igual em mobile e desktop
const FEDERAL_SPEED_PX_S = 280;
const SPEED_MAP_PX_S: Record<number, number> = { 1: 180, 2: 260, 3: 360, 4: 480 };

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
        setDuration(Math.max(6, distance / pxPerSecond));
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

    if (isFederalToday && federalResult) {
      return `🏆 SAIU O RESULTADO DA FEDERAL! Concurso ${federalResult.draw_number || ''} — 1º ${federalResult.prize_1_milhar} (${federalResult.prize_1_bicho}) | 2º ${federalResult.prize_2_milhar} (${federalResult.prize_2_bicho}) | 3º ${federalResult.prize_3_milhar} (${federalResult.prize_3_bicho}) | 4º ${federalResult.prize_4_milhar} (${federalResult.prize_4_bicho}) | 5º ${federalResult.prize_5_milhar} (${federalResult.prize_5_bicho}) 🏆`;
    }
    if (clock.totalSeconds < toSeconds(20, 30)) {
      return `🎉 HOJE TEM FEDERAL! Sorteio às 20h30 — fique ligado no resultado aqui no Só Resultados 🎉`;
    }
    return null;
  }, [tick, isFederalToday, federalResult]);

  const hasTickerMessage = ticker && ticker.is_active && ticker.message;
  const hasFederalMessage = !!federalMessage;

  const federalScroll = useScrollDuration(federalMessage, FEDERAL_SPEED_PX_S);
  const tickerSpeedPx = ticker ? SPEED_MAP_PX_S[ticker.speed] || 130 : 130;
  const tickerScroll = useScrollDuration(ticker?.message, tickerSpeedPx);

  if (!hasTickerMessage && !hasFederalMessage) return null;

  return (
    <div className="flex flex-col">
      {hasFederalMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{ backgroundColor: '#b8860b', color: '#ffffff', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <div
            ref={federalScroll.trackRef}
            className="inline-block animate-ticker py-2 font-bold"
            style={{ animationDuration: `${federalScroll.duration}s` }}
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
            style={{ animationDuration: `${tickerScroll.duration}s` }}
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
