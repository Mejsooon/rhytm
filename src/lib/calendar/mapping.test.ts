import { describe, expect, it } from 'vitest';
import { rowToException, rowToSeries, seriesToRow } from './mapping';

const base = {
  id: 'b1',
  user_id: 'user_1',
  title: 'Nauka',
  color: 'blue',
  note: null,
  start_local: '2026-11-16T09:00',
  duration_min: 90,
  timezone: 'Europe/Warsaw',
  created_at: '2026-11-13T10:00:00Z',
};

describe('mapping wierszy bloków', () => {
  it('round-trip zachowuje wszystkie pola, w tym recurrence: null', () => {
    const row = { ...base, recurrence: null };
    const series = rowToSeries(row);
    expect(series).toEqual({
      id: 'b1', title: 'Nauka', color: 'blue', note: null,
      startLocal: '2026-11-16T09:00', durationMin: 90, timezone: 'Europe/Warsaw', recurrence: null,
    });
    expect(seriesToRow(series)).toEqual({
      id: 'b1', title: 'Nauka', color: 'blue', note: null,
      start_local: '2026-11-16T09:00', duration_min: 90, timezone: 'Europe/Warsaw', recurrence: null,
    });
  });

  it('round-trip zachowuje custom z byWeekday i until', () => {
    const recurrence = { freq: 'custom', byWeekday: [1, 3, 5], until: '2027-01-31' };
    const series = rowToSeries({ ...base, note: 'notatka', recurrence });
    expect(series.recurrence).toEqual(recurrence);
    expect(series.note).toBe('notatka');
    expect(rowToSeries({ ...base, ...seriesToRow(series) } as never)).toEqual(series);
  });

  it('seriesToRow bez id nie dodaje klucza id (insert generuje id)', () => {
    const noId = { ...rowToSeries({ ...base, recurrence: null }), id: undefined };
    expect('id' in seriesToRow(noId)).toBe(false);
  });
});

describe('rowToException', () => {
  it('pomija kolumny null (pole nienadpisane)', () => {
    expect(
      rowToException({
        block_id: 'b1', occurrence_date: '2026-11-16', cancelled: false,
        start_local: '2026-11-18T12:00:00', duration_min: null, title: null, color: 'red', note: null,
      }),
    ).toEqual({ blockId: 'b1', occurrenceDate: '2026-11-16', cancelled: false, startLocal: '2026-11-18T12:00:00', color: 'red' });
  });
});
