import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getActiveDailySchedule, formatExtractionTime, getSaoPauloClock, toSeconds } from '@/lib/drawSchedule';

function getNextDraw() {
  const now = getSaoPauloClock();
  const todaySchedule = getActiveDailySchedule(now.weekday);

  for (const draw of todaySchedule) {
    const drawSecs = toSeconds(draw.extractionHour, draw.extractionMinute);
    if (drawSecs > now.totalSeconds) {
      const diff = drawSecs - now.totalSeconds;
      return { label: draw.label, extraction: formatExtractionTime(draw.extractionHour, draw.extractionMinute), seconds: diff };
    }
  }

  // All draws passed today, procurar próximo dia com sorteios
  for (let offset = 1; offset <= 7; offset++) {
    const wd = (now.weekday + offset) % 7;
    const daySchedule = getActiveDailySchedule(wd);
    if (daySchedule.length === 0) continue;
    const first = daySchedule[0];
    const diff = offset * 24 * 3600 - now.totalSeconds + toSeconds(first.extractionHour, first.extractionMinute);
    return { label: first.label + ' (amanhã)', extraction: formatExtractionTime(first.extractionHour, first.extractionMinute), seconds: diff };
  }
  return { label: '—', extraction: '--:--', seconds: 0 };
}

export function NextDrawCountdown() {
  const [next, setNext] = useState(getNextDraw);

  useEffect(() => {
    const timer = setInterval(() => setNext(getNextDraw()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(next.seconds / 3600);
  const mins = Math.floor((next.seconds % 3600) / 60);
  const secs = next.seconds % 60;

  const isUrgent = next.seconds < 300;
  const isCritical = next.seconds < 120;

  return (
    <div className={`border-b-2 transition-all duration-500 ${isCritical ? 'bg-destructive/20 border-destructive/40 animate-pulse' : isUrgent ? 'bg-destructive/15 border-destructive/30' : 'bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border-primary/30'}`}>
      <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <Clock className={`h-5 w-5 ${isCritical ? 'text-destructive animate-spin' : isUrgent ? 'text-destructive animate-pulse' : 'text-primary animate-pulse'}`} style={isCritical ? { animationDuration: '2s' } : undefined} />
          <span className={`text-sm font-semibold uppercase tracking-wide ${isCritical ? 'text-destructive font-bold' : 'text-foreground'}`}>
            {isCritical ? '⚡ Saindo em breve!' : 'Próximo Resultado'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${isCritical || isUrgent ? 'text-destructive' : 'text-primary'}`}>
            {next.label} <span className="opacity-80 font-semibold">· sai {next.extraction}</span>
          </span>
          <div className="flex items-center gap-1">
            {[String(hours).padStart(2, '0'), String(mins).padStart(2, '0'), String(secs).padStart(2, '0')].map((unit, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className={`text-lg font-bold ${isCritical || isUrgent ? 'text-destructive' : 'text-primary'}`}>:</span>}
                <span className={`font-mono text-lg font-extrabold px-2 py-1 rounded-md transition-all ${isCritical ? 'bg-destructive/25 text-destructive border-2 border-destructive/50 shadow-[0_0_12px_hsl(var(--destructive)/0.3)] scale-105' : isUrgent ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-card border border-primary/30 text-foreground shadow-sm'}`}>
                  {unit}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
