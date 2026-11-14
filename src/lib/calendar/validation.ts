import { CATEGORY_COLORS } from './colors';
import type { Recurrence } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Waliduje pola bloku (każde opcjonalne, bo edycja podaje tylko zmieniane pola)
 * i rzuca Error z polskim komunikatem. Zwraca `title` po przycięciu białych znaków.
 * `until` porównywane jest z datą z `startLocal`, więc oba muszą być podane razem
 * (przy edycji robi to `planEdit` względem efektywnego startu serii).
 */
export function validateBlockFields(fields: {
  title?: string;
  durationMin?: number;
  startLocal?: string;
  color?: string;
  recurrence?: Recurrence | null;
}): { title?: string } {
  const result: { title?: string } = {};
  if (fields.title !== undefined) {
    const title = typeof fields.title === 'string' ? fields.title.trim() : '';
    if (title === '') throw new Error('Tytuł nie może być pusty');
    result.title = title;
  }
  if (fields.durationMin !== undefined) {
    if (!Number.isInteger(fields.durationMin) || fields.durationMin < 5 || fields.durationMin > 1440) {
      throw new Error('Czas trwania musi wynosić od 5 do 1440 minut');
    }
  }
  if (fields.startLocal !== undefined && !LOCAL_RE.test(fields.startLocal)) {
    throw new Error('Nieprawidłowa data początku');
  }
  if (fields.color !== undefined && !CATEGORY_COLORS.some((c) => c.id === fields.color)) {
    throw new Error('Nieznany kolor bloku');
  }

  // Kształt powtarzania: dane przychodzą z klienta, więc nie ufamy typom TypeScriptu.
  const rec = fields.recurrence;
  if (rec !== undefined && rec !== null) {
    const freqOk = ['daily', 'weekdays', 'weekly', 'custom'].includes(rec.freq);
    const daysOk =
      rec.freq !== 'custom' ||
      (Array.isArray(rec.byWeekday) &&
        rec.byWeekday.length > 0 &&
        rec.byWeekday.every((d) => Number.isInteger(d) && d >= 1 && d <= 7));
    const untilOk = rec.until === undefined || (typeof rec.until === 'string' && DATE_RE.test(rec.until));
    if (!freqOk || !daysOk || !untilOk) throw new Error('Nieprawidłowe powtarzanie');
  }

  const until = rec?.until;
  if (until !== undefined && fields.startLocal !== undefined && until < fields.startLocal.slice(0, 10)) {
    throw new Error('Data końca nie może być wcześniejsza niż data początku');
  }
  return result;
}
