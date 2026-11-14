import { describe, expect, it } from 'vitest';
import { expandOccurrences } from './expand';
import type { BlockException, BlockSeries } from './types';

const base: BlockSeries = {
  id: 'b1',
  title: 'Blok',
  categoryId: '11111111-1111-4111-8111-111111111111',
  note: null,
  startLocal: '2026-11-16T08:00',
  durationMin: 60,
  timezone: 'Europe/Warsaw',
  recurrence: null,
};
const dates = (s: BlockSeries, e: BlockException[], from: string, to: string) =>
  expandOccurrences(s, e, from, to).map((o) => o.occurrenceDate);

describe('expandOccurrences', () => {
  it('pojedynczy blok', () => {
    const r = expandOccurrences(base, [], '2026-11-01', '2026-11-30');
    expect(r).toHaveLength(1);
    expect(r[0].occurrenceDate).toBe('2026-11-16');
    expect(r[0].recurring).toBe(false);
  });

  it('daily: 7 wystąpień o 08:00 lokalnie', () => {
    const s = { ...base, recurrence: { freq: 'daily' as const } };
    const r = expandOccurrences(s, [], '2026-11-16', '2026-11-22');
    expect(r).toHaveLength(7);
    expect(r.every((o) => o.start.toISOString().endsWith('T07:00:00.000Z'))).toBe(true);
    expect(r[0].recurring).toBe(true);
  });

  it('weekdays: pn–pt', () => {
    const s = { ...base, recurrence: { freq: 'weekdays' as const } };
    expect(dates(s, [], '2026-11-16', '2026-11-22')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
    ]);
  });

  it('custom [1,3,5]', () => {
    const s = { ...base, recurrence: { freq: 'custom' as const, byWeekday: [1, 3, 5] as (1 | 3 | 5)[] } };
    expect(dates(s, [], '2026-11-16', '2026-11-22')).toEqual(['2026-11-16', '2026-11-18', '2026-11-20']);
  });

  it('weekly startujący w środę: tylko środy', () => {
    const s = { ...base, startLocal: '2026-11-18T08:00', recurrence: { freq: 'weekly' as const } };
    expect(dates(s, [], '2026-11-16', '2026-12-06')).toEqual(['2026-11-18', '2026-11-25', '2026-12-02']);
  });

  it('until włącznie', () => {
    const s = { ...base, recurrence: { freq: 'daily' as const, until: '2026-11-18' } };
    expect(dates(s, [], '2026-11-16', '2026-11-22')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });

  it('zakres przed startem serii', () => {
    const s = { ...base, recurrence: { freq: 'daily' as const } };
    expect(expandOccurrences(s, [], '2026-11-01', '2026-11-15')).toEqual([]);
  });

  it('DST wiosna: 28.03 = 07:00Z, 30.03 = 06:00Z', () => {
    const s = { ...base, startLocal: '2026-03-01T08:00', recurrence: { freq: 'daily' as const } };
    const r = expandOccurrences(s, [], '2026-03-28', '2026-03-31');
    expect(r.map((o) => o.start.toISOString())).toEqual([
      '2026-03-28T07:00:00.000Z', '2026-03-29T06:00:00.000Z',
      '2026-03-30T06:00:00.000Z', '2026-03-31T06:00:00.000Z',
    ]);
  });

  it('DST jesień: 06:00Z -> 07:00Z', () => {
    const s = { ...base, startLocal: '2026-10-01T08:00', recurrence: { freq: 'daily' as const } };
    const r = expandOccurrences(s, [], '2026-10-24', '2026-10-27');
    expect(r.map((o) => o.start.toISOString())).toEqual([
      '2026-10-24T06:00:00.000Z', '2026-10-25T07:00:00.000Z',
      '2026-10-26T07:00:00.000Z', '2026-10-27T07:00:00.000Z',
    ]);
  });

  it('przez północ', () => {
    const s = { ...base, startLocal: '2026-11-16T23:00', durationMin: 120 };
    const r = expandOccurrences(s, [], '2026-11-17', '2026-11-17');
    expect(r).toHaveLength(1);
    expect(r[0].occurrenceDate).toBe('2026-11-16');
  });

  it('wyjątek cancelled', () => {
    const s = { ...base, recurrence: { freq: 'daily' as const } };
    const e: BlockException[] = [{ blockId: 'b1', occurrenceDate: '2026-11-18', cancelled: true }];
    expect(dates(s, e, '2026-11-16', '2026-11-20')).toEqual(['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20']);
  });

  it('wyjątek zmodyfikowany (przesunięty na inny dzień)', () => {
    const s = { ...base, recurrence: { freq: 'daily' as const } };
    const e: BlockException[] = [
      { blockId: 'b1', occurrenceDate: '2026-11-18', cancelled: false, startLocal: '2026-11-19T10:00', title: 'Zmiana' },
    ];
    const r = expandOccurrences(s, e, '2026-11-19', '2026-11-19');
    const moved = r.find((o) => o.occurrenceDate === '2026-11-18');
    expect(moved?.start.toISOString()).toBe('2026-11-19T09:00:00.000Z');
    expect(moved?.title).toBe('Zmiana');
    // oryginalna data 18.11 poza zakresem, ale przesunięte wystąpienie wchodzi w zakres
    expect(r.map((o) => o.occurrenceDate)).toEqual(['2026-11-19', '2026-11-18']);
  });

  it('wyjątek na nieistniejącym wystąpieniu jest ignorowany', () => {
    const s = { ...base, recurrence: { freq: 'weekdays' as const } };
    const e: BlockException[] = [
      { blockId: 'b1', occurrenceDate: '2026-11-21', cancelled: false, startLocal: '2026-11-21T10:00' },
    ];
    expect(dates(s, e, '2026-11-21', '2026-11-22')).toEqual([]);
  });
});
