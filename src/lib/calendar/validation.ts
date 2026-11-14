import type { Recurrence } from './types';

/**
 * Waliduje pola bloku (każde opcjonalne, bo edycja podaje tylko zmieniane pola)
 * i rzuca Error z polskim komunikatem. Zwraca `title` po przycięciu białych znaków.
 * `until` porównywane jest z datą z `startLocal`, więc oba muszą być podane razem.
 */
export function validateBlockFields(fields: {
  title?: string;
  durationMin?: number;
  startLocal?: string;
  recurrence?: Recurrence | null;
}): { title?: string } {
  const result: { title?: string } = {};
  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (title === '') throw new Error('Tytuł nie może być pusty');
    result.title = title;
  }
  if (fields.durationMin !== undefined) {
    if (!Number.isInteger(fields.durationMin) || fields.durationMin < 5 || fields.durationMin > 1440) {
      throw new Error('Czas trwania musi wynosić od 5 do 1440 minut');
    }
  }
  const until = fields.recurrence?.until;
  if (until !== undefined && fields.startLocal !== undefined && until < fields.startLocal.slice(0, 10)) {
    throw new Error('Data końca nie może być wcześniejsza niż data początku');
  }
  return result;
}
