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
  };
}

export const DAILY_DRAW_SCHEDULE: DrawScheduleItem[] = [
  makeDailyItem('RIO', 'PPT', DRAW_TIME_LABELS.PPT, { hour: 9, minute: 0 }),
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

export const FEDERAL_DRAW: DrawScheduleItem = {
  lottery: 'FEDERAL',
  key: 'FEDERAL_1100',
  label: 'Federal',
  drawHour: 11,
  drawMinute: 0,
  extractionHour: 11,
  extractionMinute: 0,
};

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
  const schedule = DAILY_DRAW_SCHEDULE.filter((item) => item.lottery === lottery);
  const nextToday = schedule.find((item) => toSeconds(item.extractionHour, item.extractionMinute) > clock.totalSeconds);

  if (nextToday) {
    return withNextInfo(
      nextToday,
      toSeconds(nextToday.extractionHour, nextToday.extractionMinute) - clock.totalSeconds,
      'hoje',
    );
  }

  const firstTomorrow = schedule[0];
  return withNextInfo(
    firstTomorrow,
    86400 - clock.totalSeconds + toSeconds(firstTomorrow.extractionHour, firstTomorrow.extractionMinute),
    'amanhã',
  );
}

export function isFederalDrawDay(weekday: number) {
  return weekday === 0;
}

export function getNextFederalDraw(clock = getSaoPauloClock()): NextDrawInfo | null {
  if (!isFederalDrawDay(clock.weekday)) return null;

  const federalSeconds = toSeconds(FEDERAL_DRAW.extractionHour, FEDERAL_DRAW.extractionMinute);
  if (federalSeconds <= clock.totalSeconds) return null;

  return withNextInfo(FEDERAL_DRAW, federalSeconds - clock.totalSeconds, 'hoje');
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