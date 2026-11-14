import { describe, expect, it } from 'vitest';
import { occurrenceHeading, taskProgress } from './block-panel';
import type { CalendarOccurrence } from './calendar-events';

describe('taskProgress', () => {
  it('liczy zrobione, wszystkie i procent', () => {
    expect(taskProgress([{ done: true }, { done: false }, { done: true }])).toEqual({
      done: 2,
      total: 3,
      percent: (2 / 3) * 100,
      label: '2/3',
    });
  });

  it('pusta lista daje 0/0 i 0%', () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, percent: 0, label: '0/0' });
  });
});

describe('occurrenceHeading', () => {
  const occ: CalendarOccurrence = {
    blockId: 'b1',
    occurrenceDate: '2026-11-18',
    start: new Date('2026-11-18T07:00:00Z'),
    end: new Date('2026-11-18T10:00:00Z'),
    title: 'Nauka',
    color: 'green',
    note: null,
    recurring: true,
    recurrence: { freq: 'daily' },
    taskDone: 0,
    taskTotal: 0,
  };

  it('formatuje dzień tygodnia, datę i godziny w strefie profilu', () => {
    expect(occurrenceHeading(occ, 'Europe/Warsaw')).toBe('Środa, 18 listopada · 08:00–11:00');
  });
});
