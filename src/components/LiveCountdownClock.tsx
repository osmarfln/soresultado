import { useEffect, useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { getAllNextDraws, formatCountdown, type NextDrawInfo } from '@/lib/drawSchedule';

const PROXIMITY_WINDOW_SECONDS = 30 * 60; // aparece só quando falta ≤ 30min

export function LiveCountdownClock() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timeoutId: number;
    const schedule = () => {
      const delay = 1000 - (Date.now() % 1000) + 15;
      timeoutId = window.setTimeout(() => {
        setTick((n) => n + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const nearest = useMemo<NextDrawInfo | null>(() => {
    void tick;
    const draws = getAllNextDraws().filter((d) => d.dayLabel === 'hoje');
    if (draws.length === 0) return null;
    const sorted = [...draws].sort((a, b) => a.countdownSeconds - b.countdownSeconds);
    const closest = sorted[0];
    return closest.countdownSeconds <= PROXIMITY_WINDOW_SECONDS ? closest : null;
  }, [tick]);

  if (!nearest) return null;

  const urgent = nearest.countdownSeconds <= 5 * 60;

  return (
    <div
      className="fixed z-[60] right-3 sm:right-5 bottom-20 sm:bottom-24 pointer-events-none select-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-xl border-2 shadow-2xl backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-2 sm:gap-3 ${
          urgent ? 'animate-pulse' : ''
        }`}
        style={{
          background: 'rgba(6, 10, 25, 0.92)',
          borderColor: '#ef4444',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.55), 0 0 40px rgba(239, 68, 68, 0.25)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 34,
            height: 34,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.6)',
          }}
        >
          <Clock className="w-4 h-4" style={{ color: '#ff4d4d' }} />
        </div>

        <div className="flex flex-col leading-tight">
          <div
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
            style={{ color: '#fbbf24' }}
          >
            Próximo · {nearest.label}
          </div>
          <div
            className="font-mono font-black text-lg sm:text-2xl tabular-nums"
            style={{
              color: '#ff2a2a',
              textShadow: '0 0 8px rgba(255, 42, 42, 0.9), 0 0 16px rgba(255, 42, 42, 0.5)',
              letterSpacing: '0.05em',
            }}
          >
            {formatCountdown(nearest.countdownSeconds)}
          </div>
          <div className="text-[10px] sm:text-[11px] font-semibold text-white/80">
            sai {nearest.extractionLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
