import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { expandOccurrences } from './expand';
import type { BlockException, BlockSeries } from './types';

export type Scope = 'this' | 'following' | 'all';

/** Zmiana pól wystąpienia. `startLocal` to pełna lokalna data i godzina edytowanego wystąpienia. */
export type BlockChange = Partial<Pick<BlockSeries, 'title' | 'color' | 'note' | 'durationMin' | 'recurrence'>> & {
  startLocal?: string;
};

/**
 * Mutacje do wykonania przez warstwę zapisu, w podanej kolejności.
 * `deleteTasksOn.blockId` może być `tempId` z `insertSeries` z tego samego planu:
 * wykonawca podmienia go na prawdziwe id nowej serii po jej wstawieniu.
 */
export type Mutation =
  | { kind: 'upsertException'; exception: BlockException }
  | { kind: 'updateSeries'; id: string; patch: Partial<Omit<BlockSeries, 'id'>> }
  | { kind: 'insertSeries'; tempId: string; series: Omit<BlockSeries, 'id'> }
  | { kind: 'moveChildren'; fromId: string; toTempId: string; fromDate: string } // wyjątki + zadania z occurrence_date >= fromDate
  | { kind: 'deleteChildrenFrom'; id: string; fromDate: string }
  | { kind: 'deleteTasksOn'; blockId: string; dates: string[] }
  | { kind: 'deleteSeries'; id: string };

// Stałe tempId nowej serii (deterministyczne, żeby plan był czystą funkcją).
const NEW_SERIES_TEMP_ID = 'new-series';

/**
 * Planuje edycję wystąpienia bloku w danym zakresie.
 * - 'this': wyjątek dla oryginalnej `occurrenceDate` (nawet gdy start przeniesiono na inny dzień).
 * - 'all': aktualizacja serii; godzina z `change.startLocal`, a różnica dat między
 *   `change.startLocal` i `occurrenceDate` przesuwa datę startu serii o tyle samo dni.
 * - 'following': nowa seria od `occurrenceDate` (+ przesunięcie), przeniesienie dzieci,
 *   na końcu skrócenie oryginału (przerwanie w połowie nie gubi zadań).
 *   Na pierwszym wystąpieniu zachowuje się jak 'all'. Blok niecykliczny: zawsze jak 'all'.
 * `taskDates` to daty wystąpień z zadaniami; `droppedTaskDates` to te, których nowy
 * harmonogram już nie generuje (wyjątki serii nie są brane pod uwagę).
 */
export function planEdit(
  series: BlockSeries,
  occurrenceDate: string,
  scope: Scope,
  change: BlockChange,
  taskDates: string[],
): { mutations: Mutation[]; droppedTaskDates: string[] } {
  const seriesDate = series.startLocal.slice(0, 10);
  const seriesTime = series.startLocal.slice(11, 16);

  // Blok niecykliczny i 'following' na pierwszym wystąpieniu działają jak 'all'.
  let effectiveScope = scope;
  if (series.recurrence === null || (scope === 'following' && occurrenceDate === seriesDate)) {
    effectiveScope = 'all';
  }

  // Pojedyncze wystąpienie: tylko wyjątek, harmonogram serii się nie zmienia.
  if (effectiveScope === 'this') {
    const exception: BlockException = { blockId: series.id, occurrenceDate, cancelled: false };
    if (change.startLocal !== undefined) exception.startLocal = change.startLocal;
    if (change.durationMin !== undefined) exception.durationMin = change.durationMin;
    if (change.title !== undefined) exception.title = change.title;
    if (change.color !== undefined) exception.color = change.color;
    if (change.note !== undefined) exception.note = change.note;
    return { mutations: [{ kind: 'upsertException', exception }], droppedTaskDates: [] };
  }

  // Przesunięcie dni (N) i nowa godzina wynikające z `change.startLocal`.
  const shiftDays =
    change.startLocal !== undefined ? differenceInCalendarDays(parseISO(change.startLocal.slice(0, 10)), parseISO(occurrenceDate)) : 0;
  const newTime = change.startLocal !== undefined ? change.startLocal.slice(11, 16) : seriesTime;

  // Data startu zmienianej serii: dla 'all' data startu oryginału + N, dla 'following' occurrenceDate + N.
  const baseDate = effectiveScope === 'all' ? seriesDate : occurrenceDate;
  const newStartDate = format(addDays(parseISO(baseDate), shiftDays), 'yyyy-MM-dd');
  const newStartLocal = `${newStartDate}T${newTime}`;

  // Nowa wersja serii (wspólna dla 'all' i 'following').
  const updated: Omit<BlockSeries, 'id'> = {
    title: change.title ?? series.title,
    color: change.color ?? series.color,
    note: change.note !== undefined ? change.note : series.note,
    startLocal: newStartLocal,
    durationMin: change.durationMin ?? series.durationMin,
    timezone: series.timezone,
    recurrence: change.recurrence !== undefined ? change.recurrence : series.recurrence,
  };

  // Które zadania są objęte zmianą: wszystkie dla 'all', od occurrenceDate dla 'following'.
  const relevantDates = effectiveScope === 'all' ? [...taskDates] : taskDates.filter((d) => d >= occurrenceDate);
  let droppedTaskDates: string[] = [];
  if (relevantDates.length > 0) {
    const sorted = [...relevantDates].sort();
    const generated = new Set(
      expandOccurrences({ ...updated, id: series.id }, [], sorted[0], sorted[sorted.length - 1]).map((o) => o.occurrenceDate),
    );
    droppedTaskDates = relevantDates.filter((d) => !generated.has(d));
  }

  const mutations: Mutation[] = [];

  if (effectiveScope === 'all') {
    // Patch tylko z faktycznie zmienionych pól (startLocal tylko, gdy podano nowy start).
    const patch: Partial<Omit<BlockSeries, 'id'>> = {};
    if (change.title !== undefined) patch.title = change.title;
    if (change.color !== undefined) patch.color = change.color;
    if (change.note !== undefined) patch.note = change.note;
    if (change.durationMin !== undefined) patch.durationMin = change.durationMin;
    if (change.startLocal !== undefined) patch.startLocal = newStartLocal;
    if (change.recurrence !== undefined) patch.recurrence = change.recurrence;
    mutations.push({ kind: 'updateSeries', id: series.id, patch });
    if (droppedTaskDates.length > 0) {
      mutations.push({ kind: 'deleteTasksOn', blockId: series.id, dates: droppedTaskDates });
    }
    return { mutations, droppedTaskDates };
  }

  // 'following' (wystąpienie nie jest pierwsze, więc seria jest cykliczna):
  // 1) nowa seria, 2) przeniesienie dzieci, 3) sprzątanie zadań, 4) skrócenie oryginału.
  mutations.push({ kind: 'insertSeries', tempId: NEW_SERIES_TEMP_ID, series: updated });
  mutations.push({ kind: 'moveChildren', fromId: series.id, toTempId: NEW_SERIES_TEMP_ID, fromDate: occurrenceDate });
  if (droppedTaskDates.length > 0) {
    mutations.push({ kind: 'deleteTasksOn', blockId: NEW_SERIES_TEMP_ID, dates: droppedTaskDates });
  }
  const dayBefore = format(addDays(parseISO(occurrenceDate), -1), 'yyyy-MM-dd');
  mutations.push({
    kind: 'updateSeries',
    id: series.id,
    patch: { recurrence: { ...series.recurrence!, until: dayBefore } },
  });
  return { mutations, droppedTaskDates };
}

/**
 * Planuje usunięcie wystąpienia. 'this': anulowanie + usunięcie zadań tej daty;
 * 'following': skrócenie serii + usunięcie dzieci od daty; 'all', blok niecykliczny
 * oraz 'following' na pierwszym wystąpieniu: usunięcie całej serii.
 */
export function planDelete(series: BlockSeries, occurrenceDate: string, scope: Scope): Mutation[] {
  const seriesDate = series.startLocal.slice(0, 10);

  if (series.recurrence === null || scope === 'all' || (scope === 'following' && occurrenceDate === seriesDate)) {
    return [{ kind: 'deleteSeries', id: series.id }];
  }

  if (scope === 'this') {
    return [
      { kind: 'upsertException', exception: { blockId: series.id, occurrenceDate, cancelled: true } },
      { kind: 'deleteTasksOn', blockId: series.id, dates: [occurrenceDate] },
    ];
  }

  const dayBefore = format(addDays(parseISO(occurrenceDate), -1), 'yyyy-MM-dd');
  return [
    { kind: 'updateSeries', id: series.id, patch: { recurrence: { ...series.recurrence, until: dayBefore } } },
    { kind: 'deleteChildrenFrom', id: series.id, fromDate: occurrenceDate },
  ];
}
