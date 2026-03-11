import { useTicker } from '@/hooks/useTicker';

export function TickerBanner() {
  const { data: ticker } = useTicker();

  if (!ticker || !ticker.is_active || !ticker.message) return null;

  // speed: 1=lenta, 2=média, 3=rápida, 4=muito rápida
  const durationMap: Record<number, number> = { 1: 40, 2: 25, 3: 15, 4: 8 };
  const duration = `${durationMap[ticker.speed] || 25}s`;

  return (
    <div
      className="w-full overflow-hidden whitespace-nowrap relative z-50"
      style={{
        backgroundColor: ticker.bg_color,
        color: ticker.text_color,
        fontSize: ticker.font_size,
        fontFamily: ticker.font_family,
      }}
    >
      <div
        className="inline-block animate-ticker py-2 font-semibold"
        style={{ animationDuration: duration }}
      >
        <span className="px-8">{ticker.message}</span>
        <span className="px-8">{ticker.message}</span>
        <span className="px-8">{ticker.message}</span>
      </div>
    </div>
  );
}
