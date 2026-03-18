import { useTicker } from '@/hooks/useTicker';
import { useLatestFederalResult } from '@/hooks/useFederalResults';
import { getTodayDateString } from '@/lib/bichos';
import { useMemo } from 'react';

export function TickerBanner() {
  const { data: ticker } = useTicker();
  const { data: federalResult } = useLatestFederalResult();

  const today = getTodayDateString();
  const isFederalToday = federalResult && federalResult.draw_date === today;

  const federalMessage = useMemo(() => {
    if (!isFederalToday || !federalResult) return null;
    return `🏆 SAIU O RESULTADO DA FEDERAL! Concurso ${federalResult.draw_number || ''} — 1º ${federalResult.prize_1_milhar} (${federalResult.prize_1_bicho}) | 2º ${federalResult.prize_2_milhar} (${federalResult.prize_2_bicho}) | 3º ${federalResult.prize_3_milhar} (${federalResult.prize_3_bicho}) | 4º ${federalResult.prize_4_milhar} (${federalResult.prize_4_bicho}) | 5º ${federalResult.prize_5_milhar} (${federalResult.prize_5_bicho}) 🏆`;
  }, [isFederalToday, federalResult]);

  const hasTickerMessage = ticker && ticker.is_active && ticker.message;
  const hasFederalMessage = !!federalMessage;

  if (!hasTickerMessage && !hasFederalMessage) return null;

  // speed: 1=lenta, 2=média, 3=rápida, 4=muito rápida
  const durationMap: Record<number, number> = { 1: 40, 2: 25, 3: 15, 4: 8 };

  return (
    <div className="flex flex-col">
      {/* Federal alert ticker */}
      {hasFederalMessage && (
        <div
          className="w-full overflow-hidden whitespace-nowrap relative z-50"
          style={{
            backgroundColor: '#b8860b',
            color: '#ffffff',
            fontSize: '18px',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          <div
            className="inline-block animate-ticker py-2 font-bold"
            style={{ animationDuration: '30s' }}
          >
            <span className="px-8">{federalMessage}</span>
            <span className="px-8">{federalMessage}</span>
            <span className="px-8">{federalMessage}</span>
          </div>
        </div>
      )}

      {/* Regular ticker */}
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
            className="inline-block animate-ticker py-2 font-semibold"
            style={{ animationDuration: `${durationMap[ticker!.speed] || 25}s` }}
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
