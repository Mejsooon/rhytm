import { describe, expect, it } from 'vitest';
import { miniCalendarWeeks, miniDayLabel, miniHighlight, miniMonthTitle, shiftMonth } from './mini-calendar';

describe('miniCalendarWeeks', () => {
  it('listopad 2026: 6 wierszy, od pn 26 paź, tydzień ISO 44', () => {
    const nov = miniCalendarWeeks('2026-11');
    expect(nov).toHaveLength(6);
    expect(nov.every((w) => w.days.length === 7)).toBe(true);
    expect(nov[0].days[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
    expect(nov[0].week).toBe(44);
    expect(nov[5].days[6].date).toBe('2026-12-06');
  });

  it('miesiąc zaczynający się w poniedziałek nie ma dni spoza miesiąca z przodu', () => {
    const jun = miniCalendarWeeks('2026-06');
    expect(jun[0].days[0].date).toBe('2026-06-01');
    expect(jun[0].days[0].inMonth).toBe(true);
  });

  it('przełom roku: styczeń 2027 zaczyna się 2026-12-28 w tygodniu 53', () => {
    const jan = miniCalendarWeeks('2027-01');
    expect(jan[0].days[0].date).toBe('2026-12-28');
    expect(jan[0].week).toBe(53);
    expect(jan[0].days[0].inMonth).toBe(false);
    expect(jan[0].days[4]).toEqual({ date: '2027-01-01', day: 1, inMonth: true });
  });

  it('grudzień 2026 też ma tydzień 53', () => {
    const dec = miniCalendarWeeks('2026-12');
    expect(dec.map((w) => w.week)).toContain(53);
  });
});

describe('miniHighlight', () => {
  it('tydzień, dzień, miesiąc', () => {
    expect(miniHighlight('timeGridWeek', '2026-11-16')).toEqual({ kind: 'week', from: '2026-11-16', to: '2026-11-22' });
    expect(miniHighlight('timeGridDay', '2026-11-18')).toEqual({ kind: 'day', date: '2026-11-18' });
    expect(miniHighlight('dayGridMonth', '2026-11-01')).toBeNull();
  });

  it('tydzień na przełomie roku', () => {
    expect(miniHighlight('timeGridWeek', '2026-12-28')).toEqual({ kind: 'week', from: '2026-12-28', to: '2027-01-03' });
  });
});

describe('miniMonthTitle i shiftMonth', () => {
  it('tytuł po polsku z wielką literą', () => {
    expect(miniMonthTitle('2026-11')).toBe('Listopad 2026');
    expect(miniMonthTitle('2027-03')).toBe('Marzec 2027');
  });

  it('przesuwa miesiąc przez granicę roku', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
});

describe('miniDayLabel', () => {
  it('data po polsku w dopełniaczu', () => {
    expect(miniDayLabel('2026-11-18')).toBe('18 listopada 2026');
    expect(miniDayLabel('2027-01-01')).toBe('1 stycznia 2027');
  });
});
