import { useTicker } from '@/hooks/useTicker';

export function TickerBanner() {
  const { data: ticker } = useTicker();

  if (!ticker || !ticker.is_active || !ticker.message) return null;

  const speed = ticker.speed || 60;
  const duration = `${Math.max(10, ticker.message.length * (100 / speed))}s`;

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
