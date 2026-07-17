import { useTicker } from '@/hooks/useTicker';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import { getTodayDateString } from '@/lib/bichos';
import { useEffect, useMemo, useState } from 'react';

function currentHourBRT(): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date());
  return parseInt(h, 10);
}

function currentWeekdayBRT(): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[s] ?? new Date().getDay();
}

export function TickerBanner() {
  const { data: ticker } = useTicker();
  const { data: federalResult } = useLatestFederalResult();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = getTodayDateString();
  const isFederalToday = !!federalResult && federalResult.draw_date === today;

  // Federal ticker: só em quarta (3) e sábado (6)
  const federalMessage = useMemo(() => {
    void tick;
    const wd = currentWeekdayBRT();
    const hour = currentHourBRT();
    const isFedDay = wd === 3 || wd === 6;
    if (!isFedDay) return null;

    if (isFederalToday && federalResult) {
      return `🏆 SAIU O RESULTADO DA FEDERAL! Concurso ${federalResult.draw_number || ''} — 1º ${federalResult.prize_1_milhar} (${federalResult.prize_1_bicho}) | 2º ${federalResult.prize_2_milhar} (${federalResult.prize_2_bicho}) | 3º ${federalResult.prize_3_milhar} (${federalResult.prize_3_bicho}) | 4º ${federalResult.prize_4_milhar} (${federalResult.prize_4_bicho}) | 5º ${federalResult.prize_5_milhar} (${federalResult.prize_5_bicho}) 🏆`;
    }
    if (hour < 21) {
      return `🎉 HOJE TEM FEDERAL! Sorteio às 20h30 — fique ligado no resultado aqui no Só Resultados 🎉`;
    }
    return null;
  }, [tick, isFederalToday, federalResult]);

  const hasTickerMessage = ticker && ticker.is_active && ticker.message;
  const hasFederalMessage = !!federalMessage;

  if (!hasTickerMessage && !hasFederalMessage) return null;

  const durationMap: Record<number, number> = { 1: 28, 2: 18, 3: 11, 4: 6 };

  return (
    <div className="flex flex-col">
      {hasFederalMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{ backgroundColor: '#b8860b', color: '#ffffff', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <div className="inline-block animate-ticker py-2 font-bold" style={{ animationDuration: '20s' }}>
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
          <div className="inline-block animate-ticker py-2 font-semibold" style={{ animationDuration: `${durationMap[ticker!.speed] || 25}s` }}>
            <span className="px-8">{ticker!.message}</span>
            <span className="px-8">{ticker!.message}</span>
            <span className="px-8">{ticker!.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
