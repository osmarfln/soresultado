import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFederalDrawForWeekday,
  isFederalDrawDay,
  getNextFederalDraw,
  setFederalScheduleRules,
  getSaoPauloClock,
} from './drawSchedule';

// Restaura defaults (Qua 20:30 + Dom 11:34) antes de cada teste
beforeEach(() => {
  setFederalScheduleRules([
    { weekday: 3, drawHour: 20, drawMinute: 30, enabled: true },
    { weekday: 0, drawHour: 11, drawMinute: 34, enabled: true },
  ]);
});

describe('Federal schedule — defaults', () => {
  it('quarta (3) retorna 20:30', () => {
    const item = getFederalDrawForWeekday(3);
    expect(item).not.toBeNull();
    expect(item!.drawHour).toBe(20);
    expect(item!.drawMinute).toBe(30);
  });

  it('domingo (0) retorna 11:34', () => {
    const item = getFederalDrawForWeekday(0);
    expect(item).not.toBeNull();
    expect(item!.drawHour).toBe(11);
    expect(item!.drawMinute).toBe(34);
  });

  it.each([1, 2, 4, 5, 6])('dia %i retorna null', (wd) => {
    expect(getFederalDrawForWeekday(wd)).toBeNull();
  });

  it.each([[0, true], [3, true], [1, false], [2, false], [4, false], [5, false], [6, false]] as const)(
    'isFederalDrawDay(%i) === %s',
    (wd, expected) => {
      expect(isFederalDrawDay(wd)).toBe(expected);
    },
  );
});

describe('getNextFederalDraw', () => {
  // helper: cria um clock fake para dia/hora arbitrários
  const makeClock = (weekday: number, hour: number, minute: number) => ({
    weekday, hour, minute, second: 0, totalSeconds: hour * 3600 + minute * 60,
  });

  it('quarta 10:00 → aponta para hoje 20:30', () => {
    const next = getNextFederalDraw(makeClock(3, 10, 0));
    expect(next).not.toBeNull();
    expect(next!.dayLabel).toBe('hoje');
    expect(next!.drawHour).toBe(20);
    expect(next!.drawMinute).toBe(30);
  });

  it('quarta 21:00 (após sorteio) → próximo é domingo 11:34', () => {
    const next = getNextFederalDraw(makeClock(3, 21, 0));
    expect(next).not.toBeNull();
    expect(next!.drawHour).toBe(11);
    expect(next!.drawMinute).toBe(34);
  });

  it('sábado 08:00 → próximo é domingo 11:34', () => {
    const next = getNextFederalDraw(makeClock(6, 8, 0));
    expect(next).not.toBeNull();
    expect(next!.drawHour).toBe(11);
    expect(next!.drawMinute).toBe(34);
  });

  it('domingo 15:00 (após sorteio) → próximo é quarta 20:30', () => {
    const next = getNextFederalDraw(makeClock(0, 15, 0));
    expect(next).not.toBeNull();
    expect(next!.drawHour).toBe(20);
    expect(next!.drawMinute).toBe(30);
  });
});

describe('regras dinâmicas', () => {
  it('regras desabilitadas caem para defaults', () => {
    setFederalScheduleRules([]);
    // Sem regras, o helper cai nos defaults (Qua 20:30 / Dom 11:34)
    expect(getFederalDrawForWeekday(3)?.drawHour).toBe(20);
    expect(getFederalDrawForWeekday(0)?.drawHour).toBe(11);
  });

  it('admin pode mover a Federal para sexta 21:00', () => {
    setFederalScheduleRules([{ weekday: 5, drawHour: 21, drawMinute: 0, enabled: true }]);
    expect(getFederalDrawForWeekday(5)?.drawHour).toBe(21);
    expect(getFederalDrawForWeekday(3)).toBeNull();
    expect(getFederalDrawForWeekday(0)).toBeNull();
    expect(isFederalDrawDay(5)).toBe(true);
    expect(isFederalDrawDay(3)).toBe(false);
  });
});

describe('getSaoPauloClock', () => {
  it('retorna estrutura consistente', () => {
    const clock = getSaoPauloClock();
    expect(clock.hour).toBeGreaterThanOrEqual(0);
    expect(clock.hour).toBeLessThan(24);
    expect(clock.weekday).toBeGreaterThanOrEqual(0);
    expect(clock.weekday).toBeLessThan(7);
  });
});
