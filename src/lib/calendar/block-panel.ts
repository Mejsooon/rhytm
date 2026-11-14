import { toLocalString } from './block-form';
import type { CalendarOccurrence } from './calendar-events';

/** Licznik i pasek postępu listy zadań wystąpienia. */
export function taskProgress(tasks: { done: boolean }[]) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return { done, total, percent: total === 0 ? 0 : (done / total) * 100, label: `${done}/${total}` };
}

/** Podtytuł panelu: „Środa, 18 listopada · 08:00–11:00” (strefa profilu). */
export function occurrenceHeading(occurrence: CalendarOccurrence, timezone: string): string {
  const start = toLocalString(occurrence.start, timezone);
  const end = toLocalString(occurrence.end, timezone);
  const day = new Date(`${start.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${start.slice(11)}–${end.slice(11)}`;
}
