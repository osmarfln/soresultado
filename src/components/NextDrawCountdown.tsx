import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// All draw times across Rio, Capital, SP with hour:minute in BRT
const ALL_DRAWS = [
  { label: 'PT-SP 08h20', hour: 8, minute: 20 },
  { label: 'LCap 09h00', hour: 9, minute: 0 },
  { label: 'PPT Rio 09h00', hour: 9, minute: 0 },
  { label: 'PT-SP 10h00', hour: 10, minute: 0 },
  { label: 'LCap 10h00', hour: 10, minute: 0 },
  { label: 'PTM Rio 11h00', hour: 11, minute: 0 },
  { label: 'LCap 11h00', hour: 11, minute: 0 },
  { label: 'LCap 13h00', hour: 13, minute: 0 },
  { label: 'PT-SP 13h00', hour: 13, minute: 0 },
  { label: 'PT Rio 14h00', hour: 14, minute: 0 },
  { label: 'LCap 14h00', hour: 14, minute: 0 },
  { label: 'LCap 15h00', hour: 15, minute: 0 },
  { label: 'Band SP 15h30', hour: 15, minute: 30 },
  { label: 'PTV Rio 16h00', hour: 16, minute: 0 },
  { label: 'LCap 16h00', hour: 16, minute: 0 },
  { label: 'PTN Rio 18h00', hour: 18, minute: 0 },
  { label: 'LCap 18h00', hour: 18, minute: 0 },
  { label: 'PT-SP 19h00', hour: 19, minute: 0 },
  { label: 'LCap 20h00', hour: 20, minute: 0 },
  { label: 'PTN-SP 20h00', hour: 20, minute: 0 },
  { label: 'COR Rio 21h00', hour: 21, minute: 0 },
  { label: 'LCap 22h30', hour: 22, minute: 30 },
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

  return (
    <div className="bg-primary/10 border-b border-primary/20">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <Clock className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground">Próximo resultado:</span>
        <span className="text-xs font-bold text-primary">{next.label}</span>
        <span className="font-mono text-sm font-bold text-foreground bg-card/80 border border-border/40 rounded-md px-2 py-0.5">
          {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
