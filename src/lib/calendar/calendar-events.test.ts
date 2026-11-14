import { describe, expect, it } from 'vitest';
import { occurrenceToEvent, visibleDateRange, type CalendarOccurrence } from './calendar-events';
import { CATEGORY_COLORS, categoryColor } from './colors';

const occ: CalendarOccurrence = {
  blockId: 'b1',
  occurrenceDate: '2026-11-18',
  start: new Date('2026-11-18T07:00:00Z'),
  end: new Date('2026-11-18T08:30:00Z'),
  title: 'Nauka',
  categoryId: '11111111-1111-4111-8111-111111111111',
  note: null,
  recurring: true,
  recurrence: { freq: 'daily' },
  taskDone: 1,
  taskTotal: 2,
};

describe('occurrenceToEvent', () => {
  it('dodaje licznik zadań do tytułu', () => {
    expect(occurrenceToEvent(occ, () => 'green').title).toBe('Nauka · 1/2');
  });

  it('bez zadań zostawia sam tytuł', () => {
    expect(occurrenceToEvent({ ...occ, taskDone: 0, taskTotal: 0 }, () => 'green').title).toBe('Nauka');
  });

  it('przenosi chwile jako ISO i klasę koloru kategorii', () => {
    const ev = occurrenceToEvent(occ, () => 'green');
    expect(ev.start).toBe('2026-11-18T07:00:00.000Z');
    expect(ev.end).toBe('2026-11-18T08:30:00.000Z');
    expect(ev.class).toBe('rh-ev rh-ev-green');
    expect(ev.id).toBe('b1|2026-11-18');
    expect(ev.occurrence).toBe(occ);
  });

  it('kolor z colorOf wybiera klasę, nieznany wraca jako szary', () => {
    expect(occurrenceToEvent(occ, () => 'violet').class).toBe('rh-ev rh-ev-violet');
    expect(occurrenceToEvent(occ, () => 'pink' as never).class).toBe('rh-ev rh-ev-gray');
  });
});

describe('paleta', () => {
  it('ma 8 stałych kolorów z wartościami z projektu', () => {
    expect(CATEGORY_COLORS.map((c) => c.id)).toEqual(['blue', 'teal', 'gray', 'rose', 'orange', 'violet', 'green', 'amber']);
    expect(categoryColor('orange')).toMatchObject({ bg: '#FBF3EE', border: '#F1DDD0', dot: '#D9733A', ink: '#8A4520' });
  });
});

describe('visibleDateRange', () => {
  it('zamienia wyłączny koniec na włączną datę', () => {
    expect(visibleDateRange('2026-11-16T00:00:00+01:00', '2026-11-23T00:00:00+01:00')).toEqual({
      from: '2026-11-16',
      to: '2026-11-22',
    });
  });
});
