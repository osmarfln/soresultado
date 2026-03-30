import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// All draw times across Rio, Capital, SP with hour:minute in BRT
// Draw times + 10min buffer (results take ~15min after draw)
const ALL_DRAWS = [
  { label: 'PT-SP 08h20', hour: 8, minute: 30 },
  { label: 'LCap 09h00', hour: 9, minute: 10 },
  { label: 'PPT Rio 09h00', hour: 9, minute: 10 },
  { label: 'PT-SP 10h00', hour: 10, minute: 10 },
  { label: 'LCap 10h00', hour: 10, minute: 10 },
  { label: 'PTM Rio 11h00', hour: 11, minute: 10 },
  { label: 'LCap 11h00', hour: 11, minute: 10 },
  { label: 'LCap 13h00', hour: 13, minute: 10 },
  { label: 'PT-SP 13h00', hour: 13, minute: 10 },
  { label: 'PT Rio 14h00', hour: 14, minute: 10 },
  { label: 'LCap 14h00', hour: 14, minute: 10 },
  { label: 'LCap 15h00', hour: 15, minute: 10 },
  { label: 'Band SP 15h30', hour: 15, minute: 40 },
  { label: 'PTV Rio 16h00', hour: 16, minute: 10 },
  { label: 'LCap 16h00', hour: 16, minute: 10 },
  { label: 'PTN Rio 18h00', hour: 18, minute: 10 },
  { label: 'LCap 18h00', hour: 18, minute: 10 },
  { label: 'PT-SP 19h00', hour: 19, minute: 10 },
  { label: 'LCap 20h00', hour: 20, minute: 10 },
  { label: 'PTN-SP 20h00', hour: 20, minute: 10 },
  { label: 'COR Rio 21h00', hour: 21, minute: 10 },
  { label: 'LCap 22h30', hour: 22, minute: 40 },
].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

function getNowBRT(): Date {
  const now = new Date();
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brt;
}

function getNextDraw() {
  const now = getNowBRT();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowSeconds = now.getSeconds();
  const totalNowSecs = nowMinutes * 60 + nowSeconds;

  for (const draw of ALL_DRAWS) {
    const drawSecs = (draw.hour * 60 + draw.minute) * 60;
    if (drawSecs > totalNowSecs) {
      const diff = drawSecs - totalNowSecs;
      return { label: draw.label, seconds: diff };
    }
  }

  // All draws passed today, show first draw tomorrow
  const first = ALL_DRAWS[0];
  const drawSecs = (first.hour * 60 + first.minute) * 60;
  const diff = (24 * 3600 - totalNowSecs) + drawSecs;
  return { label: first.label + ' (amanhã)', seconds: diff };
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
          <span className={`text-sm font-bold ${isCritical || isUrgent ? 'text-destructive' : 'text-primary'}`}>{next.label}</span>
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
