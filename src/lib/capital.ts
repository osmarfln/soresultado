// Capital lottery draw times and labels
export const CAPITAL_DRAW_TIMES = [
  'LCAP_09', 'LCAP_10', 'LCAP_11', 'LCAP_13', 'PTSP_13', 'CAP_14',
  'LCAP_15', 'BAND_15', 'LCAP_16', 'CAP_18', 'LCAP_20', 'PTNSP_20', 'LCAP_2230',
] as const;

export const CAPITAL_DRAW_TIME_LABELS: Record<string, string> = {
  'LCAP_09': 'Lcap 09:00',
  'LCAP_10': 'Lcap 10:00',
  'LCAP_11': 'Lcap 11:00',
  'LCAP_13': 'Lcap 13:00',
  'PTSP_13': 'PTSP 13:00',
  'CAP_14': 'Cap 14:00',
  'LCAP_15': 'Lcap 15:00',
  'BAND_15': 'Band 15:00',
  'LCAP_16': 'Lcap 16:00',
  'CAP_18': 'Cap 18:00',
  'LCAP_20': 'Lcap 20:00',
  'PTNSP_20': 'Ptnsp 20:00',
  'LCAP_2230': 'Lcap 22:30',
};

export const CAPITAL_DRAW_TIME_HOURS: Record<string, number> = {
  'LCAP_09': 9,
  'LCAP_10': 10,
  'LCAP_11': 11,
  'LCAP_13': 13,
  'PTSP_13': 13,
  'CAP_14': 14,
  'LCAP_15': 15,
  'BAND_15': 15,
  'LCAP_16': 16,
  'CAP_18': 18,
  'LCAP_20': 20,
  'PTNSP_20': 20,
  'LCAP_2230': 22,
};
