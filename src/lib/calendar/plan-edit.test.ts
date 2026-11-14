import { describe, expect, it } from 'vitest';
import { planDelete, planEdit } from './plan-edit';
import type { BlockSeries } from './types';

// Seria codzienna od poniedziałku 16.11.2026, 08:00.
const daily: BlockSeries = {
  id: 'b1',
  title: 'Nauka',
  color: '#123456',
  note: null,
  startLocal: '2026-11-16T08:00',
  durationMin: 60,
  timezone: 'Europe/Warsaw',
  recurrence: { freq: 'daily' },
};
// Seria tygodniowa od środy 18.11.2026.
const weekly: BlockSeries = { ...daily, id: 'b2', startLocal: '2026-11-18T08:00', recurrence: { freq: 'weekly' } };
const single: BlockSeries = { ...daily, id: 'b3', recurrence: null };

describe('planEdit', () => {
  it('this: jeden wyjątek z oryginalną datą, nawet gdy nowy start jest innego dnia', () => {
    const plan = planEdit(daily, '2026-11-18', 'this', { startLocal: '2026-11-19T10:00', title: 'Inne' }, ['2026-11-18']);
    expect(plan.mutations).toEqual([
      {
        kind: 'upsertException',
        exception: {
          blockId: 'b1',
          occurrenceDate: '2026-11-18',
          cancelled: false,
          startLocal: '2026-11-19T10:00',
          title: 'Inne',
        },
      },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('all: zmiana samej godziny zachowuje datę startu serii', () => {
    const plan = planEdit(daily, '2026-11-18', 'all', { startLocal: '2026-11-18T09:00' }, []);
    expect(plan.mutations).toEqual([{ kind: 'updateSeries', id: 'b1', patch: { startLocal: '2026-11-16T09:00' } }]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('all: daily -> weekdays porzuca zadania w weekend', () => {
    const plan = planEdit(daily, '2026-11-16', 'all', { recurrence: { freq: 'weekdays' } }, ['2026-11-21', '2026-11-18']);
    expect(plan.droppedTaskDates).toEqual(['2026-11-21']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b1', patch: { recurrence: { freq: 'weekdays' } } },
      { kind: 'deleteTasksOn', blockId: 'b1', dates: ['2026-11-21'] },
    ]);
  });

  it('all: przesunięcie środa -> czwartek przesuwa start serii i porzuca stare daty', () => {
    const plan = planEdit(weekly, '2026-11-25', 'all', { startLocal: '2026-11-26T08:00' }, ['2026-11-25', '2026-12-02']);
    expect(plan.mutations[0]).toEqual({ kind: 'updateSeries', id: 'b2', patch: { startLocal: '2026-11-19T08:00' } });
    expect(plan.droppedTaskDates).toEqual(['2026-11-25', '2026-12-02']);
  });

  it('following od 18.11 dla serii od 16.11: nowa seria, przeniesienie dzieci, skrócenie oryginału', () => {
    const plan = planEdit(daily, '2026-11-18', 'following', { startLocal: '2026-11-18T09:00', title: 'Nowe' }, []);
    expect(plan.mutations).toEqual([
      {
        kind: 'insertSeries',
        tempId: 'new-series',
        series: {
          title: 'Nowe',
          color: '#123456',
          note: null,
          startLocal: '2026-11-18T09:00',
          durationMin: 60,
          timezone: 'Europe/Warsaw',
          recurrence: { freq: 'daily' },
        },
      },
      { kind: 'moveChildren', fromId: 'b1', toTempId: 'new-series', fromDate: '2026-11-18' },
      { kind: 'updateSeries', id: 'b1', patch: { recurrence: { freq: 'daily', until: '2026-11-17' } } },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('following: nowa seria dziedziczy until oryginału', () => {
    const withUntil = { ...daily, recurrence: { freq: 'daily', until: '2026-12-31' } } as BlockSeries;
    const plan = planEdit(withUntil, '2026-11-18', 'following', { title: 'X' }, []);
    const inserted = plan.mutations[0];
    expect(inserted.kind === 'insertSeries' && inserted.series.recurrence).toEqual({ freq: 'daily', until: '2026-12-31' });
  });

  it('following: porzucone zadania trafiają do nowej serii (tempId), tylko >= occurrenceDate', () => {
    const plan = planEdit(daily, '2026-11-18', 'following', { recurrence: { freq: 'weekdays' } }, ['2026-11-17', '2026-11-21']);
    expect(plan.droppedTaskDates).toEqual(['2026-11-21']);
    expect(plan.mutations).toContainEqual({ kind: 'deleteTasksOn', blockId: 'new-series', dates: ['2026-11-21'] });
    // zadanie sprzed occurrenceDate zostaje przy oryginale
    expect(plan.mutations.at(-1)?.kind).toBe('updateSeries');
  });

  it('following na pierwszym wystąpieniu = all', () => {
    const change = { startLocal: '2026-11-16T09:00', title: 'Nowe' };
    expect(planEdit(daily, '2026-11-16', 'following', change, ['2026-11-17'])).toEqual(
      planEdit(daily, '2026-11-16', 'all', change, ['2026-11-17']),
    );
  });

  it('blok niecykliczny: każdy zakres działa jak all', () => {
    const plan = planEdit(single, '2026-11-16', 'this', { title: 'Z' }, []);
    expect(plan.mutations).toEqual([{ kind: 'updateSeries', id: 'b3', patch: { title: 'Z' } }]);
  });
});

describe('planDelete', () => {
  it('this: anulowanie wystąpienia + usunięcie jego zadań', () => {
    expect(planDelete(daily, '2026-11-18', 'this')).toEqual([
      { kind: 'upsertException', exception: { blockId: 'b1', occurrenceDate: '2026-11-18', cancelled: true } },
      { kind: 'deleteTasksOn', blockId: 'b1', dates: ['2026-11-18'] },
    ]);
  });

  it('following: skrócenie serii + usunięcie dzieci od daty', () => {
    expect(planDelete(daily, '2026-11-18', 'following')).toEqual([
      { kind: 'updateSeries', id: 'b1', patch: { recurrence: { freq: 'daily', until: '2026-11-17' } } },
      { kind: 'deleteChildrenFrom', id: 'b1', fromDate: '2026-11-18' },
    ]);
  });

  it('all i blok niecykliczny: deleteSeries', () => {
    expect(planDelete(daily, '2026-11-18', 'all')).toEqual([{ kind: 'deleteSeries', id: 'b1' }]);
    expect(planDelete(single, '2026-11-16', 'this')).toEqual([{ kind: 'deleteSeries', id: 'b3' }]);
  });
});
