// Odczyt wystąpień bloków dla widocznego zakresu kalendarza. To zwykła funkcja serwerowa, a nie
// Server Action: odczyty idą przez Route Handler /api/occurrences. Server Action wywołana przez
// FullCalendar w trakcie renderowania aktualizowała Router Next.js („Cannot update a component
// (Router) while rendering…”), a do tego akcje są wykonywane po kolei, więc blokowałyby zapisy.
import { createServerClient } from "@/lib/supabase/server";
import { expandOccurrences } from "@/lib/calendar/expand";
import { rowToException, rowToSeries } from "@/lib/calendar/mapping";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Occurrence } from "@/lib/calendar/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Najdłuższy zakres: widok miesiąca to max 42 dni, reszta to zapas.
const MAX_RANGE_DAYS = 62;

export async function listOccurrences(
  from: string,
  to: string,
): Promise<(Occurrence & { taskDone: number; taskTotal: number })[]> {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) throw new Error("Nieprawidłowy zakres dat");
  if (differenceInCalendarDays(parseISO(to), parseISO(from)) > MAX_RANGE_DAYS) {
    to = format(addDays(parseISO(from), MAX_RANGE_DAYS), "yyyy-MM-dd");
  }
  const supabase = await createServerClient();

  // v1: wszystkie bloki użytkownika (RLS), rozwijanie po stronie serwera.
  const blocksRes = await supabase.from("blocks").select("*");
  if (blocksRes.error) throw new Error(`Nie udało się wczytać bloków: ${blocksRes.error.message}`);
  const series = blocksRes.data.map(rowToSeries);
  if (series.length === 0) return [];

  const exRes = await supabase.from("block_exceptions").select("*").in("block_id", series.map((s) => s.id));
  if (exRes.error) throw new Error(`Nie udało się wczytać wyjątków: ${exRes.error.message}`);
  const exceptions = exRes.data.map(rowToException);

  // Uszkodzona seria (np. zła strefa w bazie) nie może zablokować całego kalendarza: pomijamy ją i logujemy.
  const occurrences = series
    .flatMap((s) => {
      try {
        return expandOccurrences(s, exceptions, from, to);
      } catch (error) {
        console.error(`Nie udało się rozwinąć bloku ${s.id}`, error);
        return [];
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (occurrences.length === 0) return [];

  // Liczniki zadań jednym zapytaniem dla par (blockId, occurrenceDate) z wyniku.
  const tasksRes = await supabase
    .from("block_tasks")
    .select("block_id, occurrence_date, done")
    .in("block_id", [...new Set(occurrences.map((o) => o.blockId))])
    .in("occurrence_date", [...new Set(occurrences.map((o) => o.occurrenceDate))]);
  if (tasksRes.error) throw new Error(`Nie udało się wczytać zadań: ${tasksRes.error.message}`);
  const counts = new Map<string, { done: number; total: number }>();
  for (const t of tasksRes.data) {
    const key = `${t.block_id}|${t.occurrence_date}`;
    const c = counts.get(key) ?? { done: 0, total: 0 };
    c.total += 1;
    if (t.done) c.done += 1;
    counts.set(key, c);
  }

  return occurrences.map((o) => {
    const c = counts.get(`${o.blockId}|${o.occurrenceDate}`);
    return { ...o, taskDone: c?.done ?? 0, taskTotal: c?.total ?? 0 };
  });
}
