import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DAILY_DRAW_SCHEDULE,
  getFederalScheduleRules,
  getSaoPauloClock,
  toSeconds,
  type DrawScheduleItem,
  type NextDrawInfo,
  type SaoPauloClock,
  formatExtractionTime,
  getActiveDailySchedule,
  getFederalDrawForWeekday,
} from '@/lib/drawSchedule';

export interface DrawEstimate {
  avgOffsetSec: number;
  samples: number;
  lastScrapedAt: string | null;
}

export type EstimateMap = Record<string, DrawEstimate>;

let currentMap: EstimateMap = {};
const listeners = new Set<() => void>();
let started = false;
let intervalId: number | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function snapshot() {
  return currentMap;
}
function notify() {
  listeners.forEach((l) => l());
}

async function fetchEstimates() {
  try {
    const sinceIso = new Date(Date.now() - 14 * 86400 * 1000).toISOString();

    const [rio, cap, sp, fed] = await Promise.all([
      supabase.from('draw_results').select('draw_time, scraped_at').gte('scraped_at', sinceIso).not('scraped_at', 'is', null).limit(1000),
      supabase.from('capital_results').select('draw_time, scraped_at').gte('scraped_at', sinceIso).not('scraped_at', 'is', null).limit(1000),
      supabase.from('sp_results').select('draw_time, scraped_at').gte('scraped_at', sinceIso).not('scraped_at', 'is', null).limit(1000),
      supabase.from('federal_results').select('scraped_at, draw_date').gte('scraped_at', sinceIso).not('scraped_at', 'is', null).limit(100),
    ]);

    const scheduleByKey = new Map(DAILY_DRAW_SCHEDULE.map((i) => [i.key, i]));
    const buckets: Record<string, number[]> = {};
    const last: Record<string, string> = {};

    const consume = (rows: Array<{ draw_time: string; scraped_at: string }> | null | undefined) => {
      if (!rows) return;
      for (const r of rows) {
        const item = scheduleByKey.get(r.draw_time);
        if (!item) continue;
        const spClock = getSaoPauloClock(new Date(r.scraped_at));
        const drawSecs = toSeconds(item.drawHour, item.drawMinute);
        const delta = spClock.totalSeconds - drawSecs;
        if (delta < 0 || delta > 3 * 3600) continue;
        (buckets[item.key] ||= []).push(delta);
        if (!last[item.key] || r.scraped_at > last[item.key]) last[item.key] = r.scraped_at;
      }
    };
    consume(rio.data as any);
    consume(cap.data as any);
    consume(sp.data as any);

    // Federal: bucket por weekday da regra
    if (fed.data) {
      const rules = getFederalScheduleRules();
      for (const r of fed.data as Array<{ scraped_at: string; draw_date: string }>) {
        const spClock = getSaoPauloClock(new Date(r.scraped_at));
        const rule = rules.find((rl) => rl.weekday === spClock.weekday);
        if (!rule) continue;
        const drawSecs = toSeconds(rule.drawHour, rule.drawMinute);
        const delta = spClock.totalSeconds - drawSecs;
        if (delta < -60 || delta > 3 * 3600) continue;
        const key = `FEDERAL_WD${rule.weekday}_${String(rule.drawHour).padStart(2, '0')}${String(rule.drawMinute).padStart(2, '0')}`;
        (buckets[key] ||= []).push(Math.max(0, delta));
        if (!last[key] || r.scraped_at > last[key]) last[key] = r.scraped_at;
      }
    }

    const map: EstimateMap = {};
    for (const key of Object.keys(buckets)) {
      const arr = buckets[key].slice().sort((a, b) => a - b);
      // mediana é robusta a outliers
      const median = arr[Math.floor(arr.length / 2)];
      map[key] = { avgOffsetSec: median, samples: arr.length, lastScrapedAt: last[key] ?? null };
    }
    currentMap = map;
    notify();
  } catch (err) {
    console.error('[useDrawEstimates] fetch failed', err);
  }
}

function ensureStarted() {
  if (started) return;
  started = true;
  fetchEstimates();
  intervalId = window.setInterval(fetchEstimates, 5 * 60 * 1000);
}

export function useDrawEstimates(): EstimateMap {
  useEffect(() => {
    ensureStarted();
    return () => {
      /* keep singleton alive */
    };
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Aplica o offset histórico (mediana de scraped_at - horário oficial) sobre um item. */
export function applyEstimate(item: DrawScheduleItem, map: EstimateMap): { hour: number; minute: number; second: number; samples: number } {
  const est = map[item.key];
  const base = toSeconds(item.drawHour, item.drawMinute);
  if (est && est.samples >= 2) {
    const total = base + est.avgOffsetSec;
    return {
      hour: Math.floor((total / 3600) % 24),
      minute: Math.floor((total / 60) % 60),
      second: total % 60,
      samples: est.samples,
    };
  }
  // Fallback: usa o horário oficial de extração já cadastrado
  return { hour: item.extractionHour, minute: item.extractionMinute, second: 0, samples: 0 };
}

export interface EstimatedDrawInfo extends NextDrawInfo {
  estimatedHour: number;
  estimatedMinute: number;
  estimatedLabel: string;
  samples: number;
}

function toEstimated(item: DrawScheduleItem, dayOffsetDays: number, clock: SaoPauloClock, map: EstimateMap): EstimatedDrawInfo {
  const est = applyEstimate(item, map);
  const estSecondsInDay = toSeconds(est.hour, est.minute, est.second);
  const secondsFromNow = dayOffsetDays * 86400 - clock.totalSeconds + estSecondsInDay;
  return {
    ...item,
    extractionLabel: formatExtractionTime(item.extractionHour, item.extractionMinute),
    countdownSeconds: secondsFromNow,
    dayLabel: dayOffsetDays === 0 ? 'hoje' : 'amanhã',
    estimatedHour: est.hour,
    estimatedMinute: est.minute,
    estimatedLabel: formatExtractionTime(est.hour, est.minute),
    samples: est.samples,
  };
}

/** Próximo sorteio de cada loteria usando o horário estimado a partir do histórico. */
export function getEstimatedNextDraws(map: EstimateMap, clock: SaoPauloClock = getSaoPauloClock()): EstimatedDrawInfo[] {
  const results: EstimatedDrawInfo[] = [];

  const dailyLotteries: Array<'RIO' | 'CAPITAL' | 'SP'> = ['RIO', 'CAPITAL', 'SP'];
  for (const lot of dailyLotteries) {
    const today = getActiveDailySchedule(clock.weekday).filter((i) => i.lottery === lot);
    let picked: EstimatedDrawInfo | null = null;
    for (const item of today) {
      const est = applyEstimate(item, map);
      const estSecs = toSeconds(est.hour, est.minute, est.second);
      if (estSecs > clock.totalSeconds) {
        picked = toEstimated(item, 0, clock, map);
        break;
      }
    }
    if (!picked) {
      for (let offset = 1; offset <= 7; offset++) {
        const wd = (clock.weekday + offset) % 7;
        const day = getActiveDailySchedule(wd).filter((i) => i.lottery === lot);
        if (day.length === 0) continue;
        picked = toEstimated(day[0], offset, clock, map);
        break;
      }
    }
    if (picked) results.push(picked);
  }

  // Federal
  const todayFed = getFederalDrawForWeekday(clock.weekday);
  let fedPicked: EstimatedDrawInfo | null = null;
  if (todayFed) {
    const est = applyEstimate(todayFed, map);
    const estSecs = toSeconds(est.hour, est.minute, est.second);
    if (estSecs > clock.totalSeconds) fedPicked = toEstimated(todayFed, 0, clock, map);
  }
  if (!fedPicked) {
    for (let offset = 1; offset <= 7; offset++) {
      const wd = (clock.weekday + offset) % 7;
      const item = getFederalDrawForWeekday(wd);
      if (item) {
        fedPicked = toEstimated(item, offset, clock, map);
        break;
      }
    }
  }
  if (fedPicked) results.push(fedPicked);

  return results;
}
