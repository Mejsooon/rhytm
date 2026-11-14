import { addDays, format, parseISO } from 'date-fns';
import { categoryColor, type CategoryColorId } from './colors';
import type { Occurrence } from './types';

/** Wystąpienie bloku z licznikami zadań (wynik `listOccurrences`). */
export type CalendarOccurrence = Occurrence & { taskDone: number; taskTotal: number };

/**
 * Zamienia wystąpienie na zdarzenie FullCalendar. Tytuł z licznikiem zadań: „Nauka · 1/2”.
 * `class` niesie kolor kategorii (z `colorOf` po id kategorii) (reguły CSS powstają z palety w colors.ts),
 * a pełne wystąpienie jedzie w `occurrence`, żeby handlery nie musiały go odtwarzać.
 */
export function occurrenceToEvent(o: CalendarOccurrence, colorOf: (categoryId: string) => CategoryColorId) {
  return {
    id: `${o.blockId}|${o.occurrenceDate}`,
    title: o.taskTotal > 0 ? `${o.title} · ${o.taskDone}/${o.taskTotal}` : o.title,
    start: o.start.toISOString(),
    end: o.end.toISOString(),
    class: `rh-ev rh-ev-${categoryColor(colorOf(o.categoryId)).id}`,
    occurrence: o,
  };
}

/**
 * Widoczny zakres FullCalendar (`startStr` włącznie, `endStr` wyłącznie, oba z datą w strefie
 * kalendarza na początku napisu) na włączny zakres dat dla `listOccurrences`.
 */
export function visibleDateRange(startStr: string, endStr: string): { from: string; to: string } {
  return {
    from: startStr.slice(0, 10),
    to: format(addDays(parseISO(endStr.slice(0, 10)), -1), 'yyyy-MM-dd'),
  };
}
