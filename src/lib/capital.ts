// Capital lottery draw times and labels
// All times available in DB enum (kept for compatibility)
export const ALL_CAPITAL_DRAW_TIMES = [
  'LCAP_09', 'LCAP_10', 'LCAP_11', 'LCAP_13', 'LCAP_14', 'PTSP_13', 'CAP_14',
  'LCAP_15', 'BAND_15', 'LCAP_16', 'LCAP_18', 'CAP_18', 'LCAP_19', 'LCAP_20', 'PTNSP_20', 'LCAP_2230',
] as const;

const EXCLUDED_CAPITAL_TIMES = new Set(['PTSP_13', 'PTNSP_20', 'BAND_15']);

export function isVisibleCapitalDrawTime(drawTime: string) {
  return !EXCLUDED_CAPITAL_TIMES.has(drawTime);
}

export const CAPITAL_DRAW_TIMES = ALL_CAPITAL_DRAW_TIMES.filter((t) => isVisibleCapitalDrawTime(t));

/** Horários exclusivos de sábado */
export const SATURDAY_ONLY_CAPITAL_TIMES = ['LCAP_18', 'LCAP_19'];
/** Horários que NÃO ocorrem aos sábados */
export const NOT_ON_SATURDAY_CAPITAL_TIMES = ['CAP_18'];
/** Horários que NÃO ocorrem aos domingos */
export const NOT_ON_SUNDAY_CAPITAL_TIMES = ['LCAP_11', 'CAP_18', 'LCAP_19', 'CAP_14'];
/** Horários que SÓ ocorrem aos domingos */
export const SUNDAY_ONLY_CAPITAL_TIMES = ['LCAP_14'];

/** Agenda da Capital conforme o dia da semana (0=Dom … 6=Sáb). */
export function getCapitalTimesForWeekday(weekday: number): string[] {
  const isSaturday = weekday === 6;
  const isSunday = weekday === 0;
  if (isSaturday) {
    return CAPITAL_DRAW_TIMES.filter(
      (t) => !NOT_ON_SATURDAY_CAPITAL_TIMES.includes(t) && !SUNDAY_ONLY_CAPITAL_TIMES.includes(t),
    );
  }
  if (isSunday) {
    // Domingo: sem LCAP_11, sem CAPITAL 14:00 e sem CAPITAL 18:00 —
    // no lugar entram LCAP 14:00 e LCAP 18:00
    return CAPITAL_DRAW_TIMES.filter((t) => !NOT_ON_SUNDAY_CAPITAL_TIMES.includes(t));
  }
  return CAPITAL_DRAW_TIMES.filter(
    (t) => !SATURDAY_ONLY_CAPITAL_TIMES.includes(t) && !SUNDAY_ONLY_CAPITAL_TIMES.includes(t),
  );
}

export const CAPITAL_DRAW_TIME_LABELS: Record<string, string> = {
  LCAP_09: 'LCAP 09:00',
  LCAP_10: 'LCAP 10:00',
  LCAP_11: 'LCAP 11:00',
  LCAP_13: 'LCAP 13:00',
  LCAP_14: 'LCAP 14:00',
  CAP_14: 'CAPITAL 14:00',
  LCAP_15: 'LCAP 15:00',
  LCAP_16: 'LCAP 16:00',
  LCAP_18: 'LCAP 18:00',
  CAP_18: 'CAPITAL 18:00',
  LCAP_19: 'CAPITAL 19:00',
  LCAP_20: 'LCAP 20:30',
  LCAP_2230: 'LCAP 22:30',
};

export const CAPITAL_SECTION_LABEL = 'CAPITAL & LCAP';

export const CAPITAL_DRAW_TIME_HOURS: Record<string, number> = {
  LCAP_09: 9,
  LCAP_10: 10,
  LCAP_11: 11,
  LCAP_13: 13,
  LCAP_14: 14,
  CAP_14: 14,
  LCAP_15: 15,
  LCAP_16: 16,
  LCAP_18: 18,
  CAP_18: 18,
  LCAP_19: 19,
  LCAP_20: 20,
  LCAP_2230: 22,
};
