import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { expandOccurrences } from './expand';
import type { BlockException, BlockSeries } from './types';

export type Scope = 'this' | 'following' | 'all';

/**
 * Zmiana pól wystąpienia; brak pola = bez zmiany. `start` to nowa chwila początku (ISO z offsetem,
 * np. z `Date.toISOString()`), a nie lokalny napis: na czas lokalny przelicza ją `planEdit`
 * w strefie BLOKU, więc zmiana strefy w profilu nie przesuwa edytowanych bloków.
 */
export type BlockChange = Partial<Pick<BlockSeries, 'title' | 'categoryId' | 'note' | 'durationMin' | 'recurrence'>> & {
  start?: string;
};

/** Pola wyjątku, które można wyczyścić (wrócić do wartości z serii). */
export type ExceptionField = 'startLocal' | 'durationMin' | 'title' | 'categoryId' | 'note';

/**
 * Mutacje do wykonania przez warstwę zapisu, w podanej kolejności.
 * `blockId` / `toTempId` może być `tempId` z `insertSeries` z tego samego planu:
 * wykonawca podmienia go na prawdziwe id nowej serii po jej wstawieniu.
 */
export type Mutation =
  | { kind: 'upsertException'; exception: BlockException }
  | { kind: 'updateSeries'; id: string; patch: Partial<Omit<BlockSeries, 'id'>> }
  | { kind: 'insertSeries'; tempId: string; series: Omit<BlockSeries, 'id'> }
  | { kind: 'moveChildren'; fromId: string; toTempId: string; fromDate: string } // wyjątki + zadania z occurrence_date >= fromDate
  | { kind: 'shiftChildren'; blockId: string; days: number } // occurrence_date wszystkich wyjątków i zadań serii += days
  | { kind: 'clearExceptionFields'; blockId: string; occurrenceDate: string; fields: ExceptionField[] }
  | { kind: 'deleteChildrenFrom'; id: string; fromDate: string }
  | { kind: 'deleteTasksOn'; blockId: string; dates: string[] }
  | { kind: 'deleteSeries'; id: string };

// Stałe tempId nowej serii (deterministyczne, żeby plan był czystą funkcją).
const NEW_SERIES_TEMP_ID = 'new-series';

/**
 * Planuje edycję wystąpienia bloku w danym zakresie.
 * `exception` to istniejący wyjątek edytowanego wystąpienia (jeśli jest). Gdy wystąpienie było
 * wcześniej przeniesione („tylko to”), przesunięcie dni liczy się od jego obecnego miejsca, nie od `occurrenceDate`.
 * - 'this': wyjątek dla oryginalnej `occurrenceDate` (nawet gdy start przeniesiono na inny dzień).
 * - 'all': aktualizacja serii; godzina z `change.start`, a przesunięcie o N dni przesuwa datę startu serii o N.
 * - 'following': nowa seria od `occurrenceDate` (+ N), przeniesienie dzieci, na końcu skrócenie
 *   oryginału (przerwanie w połowie nie gubi zadań). Na pierwszym wystąpieniu działa jak 'all'.
 *   Blok niecykliczny: zawsze jak 'all'.
 * Przy 'all' / 'following' edytowane wystąpienie wraca do serii: z jego wyjątku czyścimy pola, które zmiana ustawia.
 * Zadania i wyjątki jadą razem z wystąpieniami (przesunięcie o N dni), gdy wzorzec liczy się od daty startu
 * (blok jednorazowy, codziennie, co tydzień) i powtarzanie się nie zmienia. Dni robocze i wybrane dni są
 * przypięte do dni tygodnia, więc ich wystąpienia (i zadania) zostają na swoich datach.
 * `taskDates` to daty wystąpień z zadaniami; `droppedTaskDates` to te z nich, których wystąpienia
 * po zmianie już nie ma (ich zadania są usuwane). Rzuca Error z polskim komunikatem przy błędnej zmianie.
 */
export function planEdit(
  series: BlockSeries,
  occurrenceDate: string,
  scope: Scope,
  change: BlockChange,
  taskDates: string[],
  exception: BlockException | null = null,
): { mutations: Mutation[]; droppedTaskDates: string[] } {
  const seriesDate = series.startLocal.slice(0, 10);
  const seriesTime = series.startLocal.slice(11, 16);

  // Nowy start jako czas lokalny w strefie bloku (klient przysyła chwilę).
  let changeStartLocal: string | undefined;
  if (change.start !== undefined) {
    const instant = new Date(change.start);
    if (Number.isNaN(instant.getTime())) throw new Error('Nieprawidłowa data początku');
    changeStartLocal = formatInTimeZone(instant, series.timezone, "yyyy-MM-dd'T'HH:mm");
  }

  // Przesunięcie dni (N) mierzone od obecnego startu wystąpienia (z wyjątku, jeśli było przeniesione).
  const currentStartLocal = exception?.startLocal ?? `${occurrenceDate}T${seriesTime}`;
  const shiftDays =
    changeStartLocal !== undefined
      ? differenceInCalendarDays(parseISO(changeStartLocal.slice(0, 10)), parseISO(currentStartLocal.slice(0, 10)))
      : 0;
  const newTime = changeStartLocal !== undefined ? changeStartLocal.slice(11, 16) : seriesTime;

  // Punkt cięcia dla 'following': nowa seria startuje od min(occurrenceDate, occurrenceDate + N),
  // a oryginał kończy się dzień przed tym punktem, więc serie nigdy się nie nakładają.
  const shiftedDate = format(addDays(parseISO(occurrenceDate), shiftDays), 'yyyy-MM-dd');
  const cut = shiftedDate < occurrenceDate ? shiftedDate : occurrenceDate;

  // Blok niecykliczny i 'following' obejmujące pierwsze wystąpienie (cięcie <= start serii) działają jak 'all'.
  let effectiveScope = scope;
  if (series.recurrence === null || (scope === 'following' && cut <= seriesDate)) {
    effectiveScope = 'all';
  }

  // Pojedyncze wystąpienie: tylko wyjątek, harmonogram serii się nie zmienia.
  // Wykonawca scala go z istniejącym wyjątkiem dla tej samej daty (upsert z merge pól).
  if (effectiveScope === 'this') {
    if (change.recurrence !== undefined) {
      throw new Error('Zmianę powtarzania można zapisać tylko dla „To i następne” albo „Wszystkie”');
    }
    const ex: BlockException = { blockId: series.id, occurrenceDate, cancelled: false };
    if (changeStartLocal !== undefined) ex.startLocal = changeStartLocal;
    if (change.durationMin !== undefined) ex.durationMin = change.durationMin;
    if (change.title !== undefined) ex.title = change.title;
    if (change.categoryId !== undefined) ex.categoryId = change.categoryId;
    if (change.note !== undefined) ex.note = change.note;
    return { mutations: [{ kind: 'upsertException', exception: ex }], droppedTaskDates: [] };
  }

  // Data startu zmienianej serii: dla 'all' data startu oryginału + N, dla 'following' occurrenceDate + N.
  const baseDate = effectiveScope === 'all' ? seriesDate : occurrenceDate;
  const newStartDate = format(addDays(parseISO(baseDate), shiftDays), 'yyyy-MM-dd');

  // Nowa wersja serii (wspólna dla 'all' i 'following').
  const updated: Omit<BlockSeries, 'id'> = {
    title: change.title ?? series.title,
    categoryId: change.categoryId ?? series.categoryId,
    note: change.note !== undefined ? change.note : series.note,
    startLocal: `${newStartDate}T${newTime}`,
    durationMin: change.durationMin ?? series.durationMin,
    timezone: series.timezone,
    recurrence: change.recurrence !== undefined ? change.recurrence : series.recurrence,
  };
  // Data końca liczona względem efektywnego startu (także gdy zmienił się tylko start).
  if (updated.recurrence?.until !== undefined && updated.recurrence.until < newStartDate) {
    throw new Error('Data końca nie może być wcześniejsza niż data początku');
  }

  // O ile dni przesuwają się dzieci (zadania + wyjątki): tylko przy wzorcu liczonym od daty startu
  // i niezmienionym powtarzaniu. Inaczej zostają na swoich datach.
  const recurrenceChanged =
    change.recurrence !== undefined && JSON.stringify(change.recurrence) !== JSON.stringify(series.recurrence);
  const anchoredToStart =
    series.recurrence === null || series.recurrence.freq === 'daily' || series.recurrence.freq === 'weekly';
  const childShift = shiftDays !== 0 && !recurrenceChanged && anchoredToStart ? shiftDays : 0;

  // Zadania objęte zmianą: wszystkie dla 'all', od occurrenceDate dla 'following'. Przy 'following'
  // z ujemnym N wystąpienia oryginału z przedziału [cięcie, occurrenceDate) znikają razem z zadaniami.
  const movingDates = effectiveScope === 'all' ? [...taskDates] : taskDates.filter((d) => d >= occurrenceDate);
  const gapDates = effectiveScope === 'all' ? [] : taskDates.filter((d) => d >= cut && d < occurrenceDate);

  // Które z przesuniętych dat nowy harmonogram dalej generuje? (wyjątki nie są brane pod uwagę)
  const shiftedDropped: string[] = []; // daty po przesunięciu (do usunięcia po shiftChildren)
  const droppedTaskDates: string[] = [...gapDates]; // daty sprzed zmiany (do ostrzeżenia)
  if (movingDates.length > 0) {
    const shifted = movingDates.map((d) => format(addDays(parseISO(d), childShift), 'yyyy-MM-dd'));
    const sorted = [...shifted].sort();
    const generated = new Set(
      expandOccurrences({ ...updated, id: series.id }, [], sorted[0], sorted[sorted.length - 1]).map((o) => o.occurrenceDate),
    );
    movingDates.forEach((d, i) => {
      if (generated.has(shifted[i])) return;
      shiftedDropped.push(shifted[i]);
      droppedTaskDates.push(d);
    });
  }
  droppedTaskDates.sort();

  // Pola wyjątku edytowanego wystąpienia, które zmiana ustawia: czyścimy je, żeby wystąpienie wróciło do serii
  // (inaczej np. start z wyjątku wygrałby i blok „odskoczyłby” na stare miejsce).
  const clearFields: ExceptionField[] = [];
  if (exception) {
    if (change.start !== undefined && exception.startLocal !== undefined) clearFields.push('startLocal');
    if (change.durationMin !== undefined && exception.durationMin !== undefined) clearFields.push('durationMin');
    if (change.title !== undefined && exception.title !== undefined) clearFields.push('title');
    if (change.categoryId !== undefined && exception.categoryId !== undefined) clearFields.push('categoryId');
    if (change.note !== undefined && exception.note !== undefined) clearFields.push('note');
  }
  // Po przesunięciu dzieci wyjątek edytowanego wystąpienia leży już pod datą occurrenceDate + N.
  const editedDateAfterShift = format(addDays(parseISO(occurrenceDate), childShift), 'yyyy-MM-dd');

  const mutations: Mutation[] = [];

  if (effectiveScope === 'all') {
    // Kolejność: najpierw seria, potem dzieci. Przerwanie po dowolnym kroku niczego nie usuwa
    // poza zadaniami, które i tak miały zniknąć (deleteTasksOn jest ostatnie).
    const patch: Partial<Omit<BlockSeries, 'id'>> = {};
    if (change.title !== undefined) patch.title = change.title;
    if (change.categoryId !== undefined) patch.categoryId = change.categoryId;
    if (change.note !== undefined) patch.note = change.note;
    if (change.durationMin !== undefined) patch.durationMin = change.durationMin;
    if (change.start !== undefined) patch.startLocal = updated.startLocal;
    if (change.recurrence !== undefined) patch.recurrence = change.recurrence;
    mutations.push({ kind: 'updateSeries', id: series.id, patch });
    if (childShift !== 0) mutations.push({ kind: 'shiftChildren', blockId: series.id, days: childShift });
    if (clearFields.length > 0) {
      mutations.push({ kind: 'clearExceptionFields', blockId: series.id, occurrenceDate: editedDateAfterShift, fields: clearFields });
    }
    if (shiftedDropped.length > 0) mutations.push({ kind: 'deleteTasksOn', blockId: series.id, dates: shiftedDropped });
    return { mutations, droppedTaskDates };
  }

  // 'following' (wystąpienie nie jest pierwsze, więc seria jest cykliczna):
  // 1) nowa seria, 2) przeniesienie dzieci od occurrenceDate i ich przesunięcie, 3) sprzątanie w nowej serii,
  // 4) skrócenie oryginału, 5) usunięcie dzieci znikających wystąpień oryginału (tylko przy ujemnym N).
  mutations.push({ kind: 'insertSeries', tempId: NEW_SERIES_TEMP_ID, series: updated });
  mutations.push({ kind: 'moveChildren', fromId: series.id, toTempId: NEW_SERIES_TEMP_ID, fromDate: occurrenceDate });
  if (childShift !== 0) mutations.push({ kind: 'shiftChildren', blockId: NEW_SERIES_TEMP_ID, days: childShift });
  if (clearFields.length > 0) {
    mutations.push({ kind: 'clearExceptionFields', blockId: NEW_SERIES_TEMP_ID, occurrenceDate: editedDateAfterShift, fields: clearFields });
  }
  if (shiftedDropped.length > 0) mutations.push({ kind: 'deleteTasksOn', blockId: NEW_SERIES_TEMP_ID, dates: shiftedDropped });
  const dayBefore = format(addDays(parseISO(cut), -1), 'yyyy-MM-dd');
  mutations.push({
    kind: 'updateSeries',
    id: series.id,
    patch: { recurrence: { ...series.recurrence!, until: dayBefore } },
  });
  if (cut < occurrenceDate) mutations.push({ kind: 'deleteChildrenFrom', id: series.id, fromDate: cut });
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
