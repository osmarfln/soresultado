// Capital lottery draw times and labels
// All times available in DB enum (kept for compatibility)
export const ALL_CAPITAL_DRAW_TIMES = [
  'LCAP_09', 'LCAP_10', 'LCAP_11', 'LCAP_13', 'PTSP_13', 'CAP_14',
  'LCAP_15', 'BAND_15', 'LCAP_16', 'CAP_18', 'LCAP_19', 'LCAP_20', 'PTNSP_20', 'LCAP_2230',
] as const;

const EXCLUDED_CAPITAL_TIMES = new Set(['PTSP_13', 'PTNSP_20', 'BAND_15']);

export function isVisibleCapitalDrawTime(drawTime: string) {
  return !EXCLUDED_CAPITAL_TIMES.has(drawTime);
}

export const CAPITAL_DRAW_TIMES = ALL_CAPITAL_DRAW_TIMES.filter((t) => isVisibleCapitalDrawTime(t));

export const CAPITAL_DRAW_TIME_LABELS: Record<string, string> = {
  LCAP_09: 'LCap 09:00',
  LCAP_10: 'LCap 10:00',
  LCAP_11: 'LCap 11:00',
  LCAP_13: 'LCap 13:00',
  CAP_14: 'LCap 14:00',
  LCAP_15: 'LCap 15:00',
  LCAP_16: 'LCap 16:00',
  CAP_18: 'LCap 18:00',
  LCAP_20: 'LCap 20:30',
  LCAP_2230: 'LCap 22:30',
};

export const CAPITAL_DRAW_TIME_HOURS: Record<string, number> = {
  LCAP_09: 9,
  LCAP_10: 10,
  LCAP_11: 11,
  LCAP_13: 13,
  CAP_14: 14,
  LCAP_15: 15,
  LCAP_16: 16,
  CAP_18: 18,
  LCAP_20: 20,
  LCAP_2230: 22,
};
