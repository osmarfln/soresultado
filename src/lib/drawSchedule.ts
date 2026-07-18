import { DRAW_TIME_LABELS } from '@/lib/bichos';
import { CAPITAL_DRAW_TIME_LABELS } from '@/lib/capital';
import { SP_DRAW_TIME_LABELS } from '@/lib/sp';

export type LotteryKey = 'RIO' | 'CAPITAL' | 'SP' | 'FEDERAL';

const TIME_ZONE = 'America/Sao_Paulo';
const EXTRACTION_DELAY_MINUTES = 32;

type TimePoint = { hour: number; minute: number };

export interface DrawScheduleItem {
  lottery: LotteryKey;
  key: string;
  label: string;
  drawHour: number;
  drawMinute: number;
  extractionHour: number;
  extractionMinute: number;
  /** Weekdays (0=Dom … 6=Sáb) em que este sorteio NÃO ocorre. */
  skipOnWeekdays?: number[];
}

export interface SaoPauloClock {
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  totalSeconds: number;
}

export interface NextDrawInfo extends DrawScheduleItem {
  extractionLabel: string;
  countdownSeconds: number;
  dayLabel: 'hoje' | 'amanhã';
}

function addMinutes({ hour, minute }: TimePoint, minutesToAdd: number): TimePoint {
  const total = hour * 60 + minute + minutesToAdd;
  return {
    hour: Math.floor((total % 1440) / 60),
    minute: total % 60,
  };
}

function makeDailyItem(
  lottery: Exclude<LotteryKey, 'FEDERAL'>,
  key: string,
  label: string,
  draw: TimePoint,
  extractionOverride?: TimePoint,
  skipOnWeekdays?: number[],
): DrawScheduleItem {
  const extraction = extractionOverride ?? addMinutes(draw, EXTRACTION_DELAY_MINUTES);
  return {
    lottery,
    key,
    label,
    drawHour: draw.hour,
    drawMinute: draw.minute,
    extractionHour: extraction.hour,
    extractionMinute: extraction.minute,
    skipOnWeekdays,
  };
}

export const DAILY_DRAW_SCHEDULE: DrawScheduleItem[] = [
  // PPT Rio não ocorre aos domingos
  makeDailyItem('RIO', 'PPT', DRAW_TIME_LABELS.PPT, { hour: 9, minute: 0 }, undefined, [0]),
  makeDailyItem('RIO', 'PTM', DRAW_TIME_LABELS.PTM, { hour: 11, minute: 0 }),
  makeDailyItem('RIO', 'PT', DRAW_TIME_LABELS.PT, { hour: 14, minute: 0 }),
  makeDailyItem('RIO', 'PTV', DRAW_TIME_LABELS.PTV, { hour: 16, minute: 0 }),
  makeDailyItem('RIO', 'PTN', DRAW_TIME_LABELS.PTN, { hour: 18, minute: 0 }),
  makeDailyItem('RIO', 'COR', DRAW_TIME_LABELS.COR, { hour: 21, minute: 0 }),

  makeDailyItem('CAPITAL', 'LCAP_09', CAPITAL_DRAW_TIME_LABELS.LCAP_09, { hour: 9, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_10', CAPITAL_DRAW_TIME_LABELS.LCAP_10, { hour: 10, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_11', CAPITAL_DRAW_TIME_LABELS.LCAP_11, { hour: 11, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_13', CAPITAL_DRAW_TIME_LABELS.LCAP_13, { hour: 13, minute: 0 }),
  makeDailyItem('CAPITAL', 'CAP_14', CAPITAL_DRAW_TIME_LABELS.CAP_14, { hour: 14, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_15', CAPITAL_DRAW_TIME_LABELS.LCAP_15, { hour: 15, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_16', CAPITAL_DRAW_TIME_LABELS.LCAP_16, { hour: 16, minute: 0 }),
  makeDailyItem('CAPITAL', 'CAP_18', CAPITAL_DRAW_TIME_LABELS.CAP_18, { hour: 18, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_20', CAPITAL_DRAW_TIME_LABELS.LCAP_20, { hour: 20, minute: 0 }),
  makeDailyItem('CAPITAL', 'LCAP_2230', CAPITAL_DRAW_TIME_LABELS.LCAP_2230, { hour: 22, minute: 30 }, { hour: 22, minute: 35 }),

  makeDailyItem('SP', 'PTSP_0820', SP_DRAW_TIME_LABELS.PTSP_0820, { hour: 8, minute: 20 }),
  makeDailyItem('SP', 'PTSP_1000', SP_DRAW_TIME_LABELS.PTSP_1000, { hour: 10, minute: 0 }),
  makeDailyItem('SP', 'PTSP_1300', SP_DRAW_TIME_LABELS.PTSP_1300, { hour: 13, minute: 0 }),
  makeDailyItem('SP', 'BAND_1530', SP_DRAW_TIME_LABELS.BAND_1530, { hour: 15, minute: 30 }),
  makeDailyItem('SP', 'PTSP_1900', SP_DRAW_TIME_LABELS.PTSP_1900, { hour: 19, minute: 0 }),
  makeDailyItem('SP', 'PTNSP_2000', SP_DRAW_TIME_LABELS.PTNSP_2000, { hour: 20, minute: 0 }),
].sort((a, b) => toSeconds(a.extractionHour, a.extractionMinute) - toSeconds(b.extractionHour, b.extractionMinute));

/** Retorna somente os sorteios que ocorrem no dia da semana informado. */
export function getActiveDailySchedule(weekday: number): DrawScheduleItem[] {
  return DAILY_DRAW_SCHEDULE.filter((item) => !item.skipOnWeekdays?.includes(weekday));
}

// Federal: Quarta-feira 20:30 (sorteio Caixa) e Sábado 11:34 (sorteio Caixa)
const FEDERAL_WED: DrawScheduleItem = {
  lottery: 'FEDERAL',
  key: 'FEDERAL_WED_2030',
  label: 'Federal',
  drawHour: 20,
  drawMinute: 30,
  extractionHour: 20,
  extractionMinute: 30,
};

const FEDERAL_SAT: DrawScheduleItem = {
  lottery: 'FEDERAL',
  key: 'FEDERAL_SAT_1134',
  label: 'Federal',
  drawHour: 11,
  drawMinute: 34,
  extractionHour: 11,
  extractionMinute: 34,
};

/** Item da Federal para o dia da semana (null se não houver). */
export function getFederalDrawForWeekday(weekday: number): DrawScheduleItem | null {
  if (weekday === 3) return FEDERAL_WED;
  if (weekday === 6) return FEDERAL_SAT;
  return null;
}

/** Mantido por compatibilidade — usa o Federal de hoje ou o de sábado como fallback. */
export const FEDERAL_DRAW: DrawScheduleItem = FEDERAL_SAT;

export function formatExtractionTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function toSeconds(hour: number, minute: number, second = 0) {
  return (hour * 60 + minute) * 60 + second;
}

export function getSaoPauloClock(date = new Date()): SaoPauloClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '0';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  const second = Number(value('second'));
  const weekday = weekdayMap[value('weekday')] ?? date.getDay();

  return { hour, minute, second, weekday, totalSeconds: toSeconds(hour, minute, second) };
}

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':');
}

function withNextInfo(item: DrawScheduleItem, countdownSeconds: number, dayLabel: 'hoje' | 'amanhã'): NextDrawInfo {
  return {
    ...item,
    extractionLabel: formatExtractionTime(item.extractionHour, item.extractionMinute),
    countdownSeconds,
    dayLabel,
  };
}

export function getNextDailyDraw(lottery: Exclude<LotteryKey, 'FEDERAL'>, clock = getSaoPauloClock()): NextDrawInfo {
  const todaySchedule = getActiveDailySchedule(clock.weekday).filter((item) => item.lottery === lottery);
  const nextToday = todaySchedule.find((item) => toSeconds(item.extractionHour, item.extractionMinute) > clock.totalSeconds);

  if (nextToday) {
    return withNextInfo(
      nextToday,
      toSeconds(nextToday.extractionHour, nextToday.extractionMinute) - clock.totalSeconds,
      'hoje',
    );
  }

  // Próximo dia em que este sorteio ocorre
  for (let offset = 1; offset <= 7; offset++) {
    const wd = (clock.weekday + offset) % 7;
    const daySchedule = getActiveDailySchedule(wd).filter((item) => item.lottery === lottery);
    if (daySchedule.length === 0) continue;
    const first = daySchedule[0];
    return withNextInfo(
      first,
      offset * 86400 - clock.totalSeconds + toSeconds(first.extractionHour, first.extractionMinute),
      'amanhã',
    );
  }

  // Fallback
  const first = DAILY_DRAW_SCHEDULE.filter((item) => item.lottery === lottery)[0];
  return withNextInfo(first, 0, 'hoje');
}

export function isFederalDrawDay(weekday: number) {
  return weekday === 3 || weekday === 6;
}

export function getNextFederalDraw(clock = getSaoPauloClock()): NextDrawInfo | null {
  const todayFederal = getFederalDrawForWeekday(clock.weekday);
  if (todayFederal) {
    const federalSeconds = toSeconds(todayFederal.extractionHour, todayFederal.extractionMinute);
    if (federalSeconds > clock.totalSeconds) {
      return withNextInfo(todayFederal, federalSeconds - clock.totalSeconds, 'hoje');
    }
  }
  return null;
}

export function getAllNextDraws(clock = getSaoPauloClock()): NextDrawInfo[] {
  const nextDraws = [
    getNextDailyDraw('RIO', clock),
    getNextDailyDraw('CAPITAL', clock),
    getNextDailyDraw('SP', clock),
  ];
  const federal = getNextFederalDraw(clock);

  return federal ? [...nextDraws, federal] : nextDraws;
}