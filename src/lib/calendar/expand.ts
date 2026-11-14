import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { BlockException, BlockSeries, Occurrence } from './types';

/**
 * Rozwija serię bloków na konkretne wystąpienia, których czas trwania nachodzi
 * na lokalny zakres dat [from 00:00, to+1 00:00) w strefie serii.
 * `from` / `to` to daty 'YYYY-MM-DD' (włącznie). Wynik posortowany po `start`.
 */
export function expandOccurrences(
  series: BlockSeries,
  exceptions: BlockException[],
  from: string,
  to: string,
): Occurrence[] {
  const startDate = series.startLocal.slice(0, 10);
  const startTime = series.startLocal.slice(11, 16);
  const rec = series.recurrence;

  // Granice zakresu jako chwile UTC (wg strefy serii).
  const rangeStart = fromZonedTime(`${from}T00:00`, series.timezone);
  const rangeEnd = fromZonedTime(`${format(addDays(parseISO(to), 1), 'yyyy-MM-dd')}T00:00`, series.timezone);

  // Daty kandydujące: dni z okna zakresu (cofniętego o długość bloku) ...
  const candidates = new Set<string>();
  const backDays = Math.ceil(series.durationMin / 1440) + 1;
  const loopFrom = format(addDays(parseISO(from), -backDays), 'yyyy-MM-dd');
  const first = loopFrom > startDate ? loopFrom : startDate;
  const last = rec?.until && rec.until < to ? rec.until : to;
  for (let d = parseISO(first); format(d, 'yyyy-MM-dd') <= last; d = addDays(d, 1)) {
    candidates.add(format(d, 'yyyy-MM-dd'));
  }
  // ... oraz daty z wyjątków (przesunięte wystąpienie może wejść w zakres z daty spoza niego).
  const exceptionByDate = new Map<string, BlockException>();
  for (const ex of exceptions) {
    if (ex.blockId !== series.id) continue;
    exceptionByDate.set(ex.occurrenceDate, ex);
    candidates.add(ex.occurrenceDate);
  }
  // Seria jednorazowa ma tylko jedno wystąpienie: dzień startu.
  if (!rec) {
    candidates.clear();
    candidates.add(startDate);
  }

  const result: Occurrence[] = [];
  for (const date of candidates) {
    // Czy data jest poprawnym wystąpieniem serii? (nie jest -> także wyjątek jest ignorowany)
    if (date < startDate) continue;
    if (rec) {
      if (rec.until && date > rec.until) continue;
      const isoWeekday = Number(format(parseISO(date), 'i'));
      const startWeekday = Number(format(parseISO(startDate), 'i'));
      let matches = true;
      if (rec.freq === 'weekdays') matches = isoWeekday <= 5;
      else if (rec.freq === 'weekly') matches = isoWeekday === startWeekday;
      else if (rec.freq === 'custom') matches = (rec.byWeekday as number[]).includes(isoWeekday);
      if (!matches) continue;
    } else if (date !== startDate) {
      continue;
    }

    // Nałożenie wyjątku: anulowanie albo zmiana pól.
    const ex = exceptionByDate.get(date);
    if (ex?.cancelled) continue;
    const localStart = ex?.startLocal ?? `${date}T${startTime}`;
    const durationMin = ex?.durationMin ?? series.durationMin;

    // Czas lokalny -> UTC (godzina lokalna stała mimo zmiany czasu).
    const start = fromZonedTime(localStart, series.timezone);
    const end = new Date(start.getTime() + durationMin * 60_000);

    // Nałożenie na zakres: [start, end) przecina [rangeStart, rangeEnd).
    if (!(start < rangeEnd && end > rangeStart)) continue;

    result.push({
      blockId: series.id,
      occurrenceDate: date,
      start,
      end,
      title: ex?.title ?? series.title,
      color: ex?.color ?? series.color,
      note: ex && ex.note !== undefined ? ex.note : series.note,
      recurring: rec !== null,
      recurrence: rec,
    });
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}
