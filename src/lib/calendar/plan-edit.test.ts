import { describe, expect, it } from 'vitest';
import { expandOccurrences } from './expand';
import { planDelete, planEdit } from './plan-edit';
import type { BlockException, BlockSeries } from './types';

// Chwila (ISO) dla lokalnego czasu Warszawy w listopadzie (UTC+1), tak jak wysyła ją klient.
const at = (local: string) => new Date(`${local}:00+01:00`).toISOString();

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
    const plan = planEdit(daily, '2026-11-18', 'this', { start: at('2026-11-19T10:00'), title: 'Inne' }, ['2026-11-18']);
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
    const plan = planEdit(daily, '2026-11-18', 'all', { start: at('2026-11-18T09:00') }, []);
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

  it('all: przesunięcie środa -> czwartek przesuwa start serii, a zadania i wyjątki jadą razem z wystąpieniami', () => {
    const plan = planEdit(weekly, '2026-11-25', 'all', { start: at('2026-11-26T08:00') }, ['2026-11-25', '2026-12-02']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b2', patch: { startLocal: '2026-11-19T08:00' } },
      { kind: 'shiftChildren', blockId: 'b2', days: 1 },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('following od 18.11 dla serii od 16.11: nowa seria, przeniesienie dzieci, skrócenie oryginału', () => {
    const plan = planEdit(daily, '2026-11-18', 'following', { start: at('2026-11-18T09:00'), title: 'Nowe' }, []);
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

  it('following z ujemnym przesunięciem: brak nakładania serii, zadania 18.11 jadą na 17.11, a stare 17.11 znika', () => {
    const plan = planEdit(daily, '2026-11-18', 'following', { start: at('2026-11-17T09:00') }, ['2026-11-17', '2026-11-18']);
    const inserted = plan.mutations[0];
    const shortened = plan.mutations[3];
    expect(inserted.kind === 'insertSeries' && inserted.series.startLocal).toBe('2026-11-17T09:00');
    expect(plan.mutations.slice(1)).toEqual([
      // Dzieci od edytowanego wystąpienia przechodzą do nowej serii i przesuwają się o -1 dzień ...
      { kind: 'moveChildren', fromId: 'b1', toTempId: 'new-series', fromDate: '2026-11-18' },
      { kind: 'shiftChildren', blockId: 'new-series', days: -1 },
      // ... oryginał kończy się 16.11, a dzieci jego znikającego wystąpienia 17.11 są usuwane na końcu.
      { kind: 'updateSeries', id: 'b1', patch: { recurrence: { freq: 'daily', until: '2026-11-16' } } },
      { kind: 'deleteChildrenFrom', id: 'b1', fromDate: '2026-11-17' },
    ]);
    expect(plan.droppedTaskDates).toEqual(['2026-11-17']);
    // Żadna data nie pojawia się w obu seriach.
    if (inserted.kind !== 'insertSeries' || shortened.kind !== 'updateSeries') throw new Error('zły plan');
    const original = expandOccurrences({ ...daily, ...shortened.patch }, [], '2026-11-14', '2026-11-22').map((o) => o.occurrenceDate);
    const created = expandOccurrences({ ...inserted.series, id: 'n' }, [], '2026-11-14', '2026-11-22').map((o) => o.occurrenceDate);
    expect(original.filter((d) => created.includes(d))).toEqual([]);
  });

  it('following na pierwszym wystąpieniu = all', () => {
    const change = { start: at('2026-11-16T09:00'), title: 'Nowe' };
    expect(planEdit(daily, '2026-11-16', 'following', change, ['2026-11-17'])).toEqual(
      planEdit(daily, '2026-11-16', 'all', change, ['2026-11-17']),
    );
  });

  it('blok niecykliczny: każdy zakres działa jak all', () => {
    const plan = planEdit(single, '2026-11-16', 'this', { title: 'Z' }, []);
    expect(plan.mutations).toEqual([{ kind: 'updateSeries', id: 'b3', patch: { title: 'Z' } }]);
  });
});

// Seria tygodniowa: poniedziałki 10:00 od 9.11.2026. Wystąpienie 16.11 przeniesione („tylko to”) na środę 18.11, 12:00.
const mondays: BlockSeries = { ...daily, id: 'b4', startLocal: '2026-11-09T10:00', recurrence: { freq: 'weekly' } };
const movedEx: BlockException = { blockId: 'b4', occurrenceDate: '2026-11-16', cancelled: false, startLocal: '2026-11-18T12:00' };

describe('planEdit: przeniesione wystąpienie (finding 1)', () => {
  it('all, sama zmiana nazwy: bez przesuwania serii i bez usuwania zadań', () => {
    const plan = planEdit(mondays, '2026-11-16', 'all', { title: 'Nowa nazwa' }, ['2026-11-09', '2026-11-16'], movedEx);
    expect(plan.mutations).toEqual([{ kind: 'updateSeries', id: 'b4', patch: { title: 'Nowa nazwa' } }]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('all, przeciągnięcie w tym samym dniu: przesunięcie liczone od miejsca wyjątku, start wyjątku czyszczony', () => {
    const plan = planEdit(mondays, '2026-11-16', 'all', { start: at('2026-11-18T14:00'), durationMin: 60 }, ['2026-11-16'], movedEx);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b4', patch: { startLocal: '2026-11-09T14:00', durationMin: 60 } },
      // Wystąpienie wraca do serii (inaczej start z wyjątku wygrałby i blok „odskoczyłby” na stare miejsce).
      { kind: 'clearExceptionFields', blockId: 'b4', occurrenceDate: '2026-11-16', fields: ['startLocal'] },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('following, przeciągnięcie środa -> czwartek: nowa seria od wtorku 17.11, dzieci przesunięte o 1 dzień', () => {
    const plan = planEdit(mondays, '2026-11-16', 'following', { start: at('2026-11-19T12:00'), durationMin: 60 }, ['2026-11-09', '2026-11-16', '2026-11-23'], movedEx);
    expect(plan.mutations).toEqual([
      {
        kind: 'insertSeries',
        tempId: 'new-series',
        series: { ...mondays, id: undefined, startLocal: '2026-11-17T12:00' },
      },
      { kind: 'moveChildren', fromId: 'b4', toTempId: 'new-series', fromDate: '2026-11-16' },
      { kind: 'shiftChildren', blockId: 'new-series', days: 1 },
      { kind: 'clearExceptionFields', blockId: 'new-series', occurrenceDate: '2026-11-17', fields: ['startLocal'] },
      { kind: 'updateSeries', id: 'b4', patch: { recurrence: { freq: 'weekly', until: '2026-11-15' } } },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('all: zmiana pola nadpisanego w wyjątku czyści tylko to pole', () => {
    const ex: BlockException = { ...movedEx, title: 'Stara', color: 'red' };
    const plan = planEdit(mondays, '2026-11-16', 'all', { title: 'Nowa' }, [], ex);
    expect(plan.mutations).toContainEqual({ kind: 'clearExceptionFields', blockId: 'b4', occurrenceDate: '2026-11-16', fields: ['title'] });
  });
});

describe('planEdit: przesuwanie dni zachowuje zadania (finding 4)', () => {
  it('co tydzień pn -> wt, wszystkie: zadania przesunięte o 1 dzień, nic nie znika', () => {
    const plan = planEdit(mondays, '2026-11-16', 'all', { start: at('2026-11-17T10:00') }, ['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b4', patch: { startLocal: '2026-11-10T10:00' } },
      { kind: 'shiftChildren', blockId: 'b4', days: 1 },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('blok jednorazowy przeniesiony na inny dzień zabiera swoje zadania', () => {
    const plan = planEdit(single, '2026-11-16', 'this', { start: at('2026-11-18T08:00') }, ['2026-11-16']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b3', patch: { startLocal: '2026-11-18T08:00' } },
      { kind: 'shiftChildren', blockId: 'b3', days: 2 },
    ]);
    expect(plan.droppedTaskDates).toEqual([]);
  });

  it('zmiana powtarzania razem z przesunięciem: zadania zostają na datach i znikają tylko niegenerowane', () => {
    const plan = planEdit(mondays, '2026-11-16', 'all', { start: at('2026-11-17T10:00'), recurrence: { freq: 'weekdays' } }, ['2026-11-09', '2026-11-12', '2026-11-14']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b4', patch: { startLocal: '2026-11-10T10:00', recurrence: { freq: 'weekdays' } } },
      { kind: 'deleteTasksOn', blockId: 'b4', dates: ['2026-11-09', '2026-11-14'] },
    ]);
    expect(plan.droppedTaskDates).toEqual(['2026-11-09', '2026-11-14']);
  });

  it('dni robocze: wzorzec przypięty do dni tygodnia, więc zadania się nie przesuwają', () => {
    const workdays: BlockSeries = { ...daily, recurrence: { freq: 'weekdays' } };
    const plan = planEdit(workdays, '2026-11-16', 'all', { start: at('2026-11-17T08:00') }, ['2026-11-16', '2026-11-18']);
    expect(plan.mutations).toEqual([
      { kind: 'updateSeries', id: 'b1', patch: { startLocal: '2026-11-17T08:00' } },
      { kind: 'deleteTasksOn', blockId: 'b1', dates: ['2026-11-16'] },
    ]);
    expect(plan.droppedTaskDates).toEqual(['2026-11-16']);
  });

  it('zmiana powtarzania z zakresem „tylko to” jest błędem', () => {
    expect(() => planEdit(daily, '2026-11-18', 'this', { recurrence: { freq: 'weekdays' } }, [])).toThrow(/To i następne/);
  });
});

describe('planEdit: strefa bloku inna niż strefa profilu (finding 5)', () => {
  // Blok założony w Nowym Jorku (08:00 lokalnie = 14:00 w Warszawie). Użytkownik ma teraz profil w Warszawie
  // i przeciąga blok na 15:00 swojego czasu: klient wysyła chwilę, serwer zapisuje 09:00 czasu Nowego Jorku.
  const ny: BlockSeries = { ...daily, id: 'b5', timezone: 'America/New_York' };

  it('all: nowa godzina w strefie bloku', () => {
    const plan = planEdit(ny, '2026-11-18', 'all', { start: at('2026-11-18T15:00') }, []);
    expect(plan.mutations).toEqual([{ kind: 'updateSeries', id: 'b5', patch: { startLocal: '2026-11-16T09:00' } }]);
  });

  it('this: wyjątek w czasie lokalnym strefy bloku, także gdy dzień w strefie profilu jest inny', () => {
    // 02:00 w Warszawie 19.11 to wciąż 18.11, 20:00 w Nowym Jorku.
    const plan = planEdit(ny, '2026-11-18', 'this', { start: at('2026-11-19T02:00') }, []);
    expect(plan.mutations).toEqual([
      { kind: 'upsertException', exception: { blockId: 'b5', occurrenceDate: '2026-11-18', cancelled: false, startLocal: '2026-11-18T20:00' } },
    ]);
  });

  it('nieprawidłowa chwila startu to błąd', () => {
    expect(() => planEdit(ny, '2026-11-18', 'all', { start: 'jutro' }, [])).toThrow('Nieprawidłowa data początku');
  });
});

describe('planEdit: data końca względem efektywnego startu (finding 8)', () => {
  const withUntil: BlockSeries = { ...daily, recurrence: { freq: 'daily', until: '2026-11-30' } };

  it('all: przesunięcie startu serii za until jest błędem, nawet bez zmiany powtarzania', () => {
    expect(() => planEdit(withUntil, '2026-11-20', 'all', { start: at('2026-12-15T08:00') }, [])).toThrow(
      'Data końca nie może być wcześniejsza niż data początku',
    );
  });

  it('following: nowa seria nie może zaczynać się po until', () => {
    expect(() => planEdit(withUntil, '2026-11-28', 'following', { start: at('2026-12-02T08:00') }, [])).toThrow(
      'Data końca nie może być wcześniejsza niż data początku',
    );
  });

  it('nowe until przed efektywnym startem nowej serii (following) jest błędem', () => {
    expect(() => planEdit(daily, '2026-11-20', 'following', { recurrence: { freq: 'daily', until: '2026-11-19' } }, [])).toThrow(
      'Data końca nie może być wcześniejsza niż data początku',
    );
    // To samo until dla „wszystkie” jest poprawne (seria startuje 16.11).
    expect(() => planEdit(daily, '2026-11-20', 'all', { recurrence: { freq: 'daily', until: '2026-11-19' } }, [])).not.toThrow();
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
