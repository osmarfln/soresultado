// São Paulo lottery draw times and labels
export const SP_DRAW_TIMES = [
  'PTSP_0820', 'PTSP_1000', 'PTSP_1300', 'BAND_1530', 'PTSP_1900', 'PTNSP_2000',
] as const;

export const SP_DRAW_TIME_LABELS: Record<string, string> = {
  PTSP_0820: 'PT-SP 08h20',
  PTSP_1000: 'PT-SP 10h00',
  PTSP_1300: 'PT-SP 13h00',
  BAND_1530: 'Band 15h30',
  PTSP_1900: 'PT-SP 19h00',
  PTNSP_2000: 'PTN-SP 20h00',
};

export const SP_DRAW_TIME_HOURS: Record<string, number> = {
  PTSP_0820: 8,
  PTSP_1000: 10,
  PTSP_1300: 13,
  BAND_1530: 15,
  PTSP_1900: 19,
  PTNSP_2000: 20,
};
