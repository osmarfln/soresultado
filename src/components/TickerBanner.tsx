import { useTicker } from '@/hooks/useTicker';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import { useTodayResults } from '@/hooks/useResults';
import { useTodayCapitalResults } from '@/hooks/useCapitalResults';
import { useTodaySpResults } from '@/hooks/useSpResults';
import { getTodayDateString } from '@/lib/bichos';
import { DRAW_TIME_HOURS, DRAW_TIME_LABELS } from '@/lib/bichos';
import { CAPITAL_DRAW_TIME_HOURS, CAPITAL_DRAW_TIME_LABELS } from '@/lib/capital';
import { SP_DRAW_TIME_HOURS, SP_DRAW_TIME_LABELS } from '@/lib/sp';
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

function nextDrawFor(hoursMap: Record<string, number>, labels: Record<string, string>, hour: number): string | null {
  const upcoming = Object.entries(hoursMap).filter(([, h]) => h > hour).sort((a, b) => a[1] - b[1]);
  if (!upcoming.length) return null;
  const [key, h] = upcoming[0];
  return `${labels[key] ?? key} (${String(h).padStart(2, '0')}h00)`;
}

export function TickerBanner() {
  const { data: ticker } = useTicker();
  const { data: federalResult } = useLatestFederalResult();
  const { data: rio } = useTodayResults();
  const { data: cap } = useTodayCapitalResults();
  const { data: sp } = useTodaySpResults();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = getTodayDateString();
  const isFederalToday = federalResult && federalResult.draw_date === today;

  const federalMessage = useMemo(() => {
    if (!isFederalToday || !federalResult) return null;
    return `🏆 SAIU O RESULTADO DA FEDERAL! Concurso ${federalResult.draw_number || ''} — 1º ${federalResult.prize_1_milhar} (${federalResult.prize_1_bicho}) | 2º ${federalResult.prize_2_milhar} (${federalResult.prize_2_bicho}) | 3º ${federalResult.prize_3_milhar} (${federalResult.prize_3_bicho}) | 4º ${federalResult.prize_4_milhar} (${federalResult.prize_4_bicho}) | 5º ${federalResult.prize_5_milhar} (${federalResult.prize_5_bicho}) 🏆`;
  }, [isFederalToday, federalResult]);

  // Anúncio "próximo sorteio" — após o último resultado sair
  const nextMessage = useMemo(() => {
    void tick;
    const hour = currentHourBRT();
    const wd = currentWeekdayBRT();
    const parts: string[] = [];

    const rioNext = nextDrawFor(DRAW_TIME_HOURS, DRAW_TIME_LABELS, hour);
    if (rio && rio.length > 0 && rioNext) parts.push(`RIO → ${rioNext}`);

    const capNext = nextDrawFor(CAPITAL_DRAW_TIME_HOURS, CAPITAL_DRAW_TIME_LABELS, hour);
    if (cap && cap.length > 0 && capNext) parts.push(`CAPITAL → ${capNext}`);

    const spNext = nextDrawFor(SP_DRAW_TIME_HOURS, SP_DRAW_TIME_LABELS, hour);
    if (sp && sp.length > 0 && spNext) parts.push(`SP → ${spNext}`);

    // Federal só quarta/sábado
    if ((wd === 3 || wd === 6) && hour < 20 && !isFederalToday) {
      parts.push(`🎉 HOJE TEM FEDERAL → 20h30`);
    }

    if (!parts.length) return null;
    return `⏭️ PRÓXIMOS SORTEIOS · ${parts.join('  •  ')}`;
  }, [rio, cap, sp, isFederalToday, tick]);

  const hasTickerMessage = ticker && ticker.is_active && ticker.message;
  const hasFederalMessage = !!federalMessage;
  const hasNextMessage = !!nextMessage;

  if (!hasTickerMessage && !hasFederalMessage && !hasNextMessage) return null;

  const durationMap: Record<number, number> = { 1: 40, 2: 25, 3: 15, 4: 8 };

  return (
    <div className="flex flex-col">
      {hasFederalMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{ backgroundColor: '#b8860b', color: '#ffffff', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <div className="inline-block animate-ticker py-2 font-bold" style={{ animationDuration: '30s' }}>
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
