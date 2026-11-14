import { format, parseISO, subWeeks } from 'date-fns';
import { createServerClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/profile';
import { todayIn } from '@/lib/dates';
import type { HabitHistory } from './types';

const STREAK_LOOKBACK_WEEKS = 53;
const PAGE_SIZE = 1000; // PostgREST returns at most 1000 rows per request

/** First day (YYYY-MM-DD) for which checks are loaded so that streaks reach back a full year. */
export function checksFrom(from: string): string {
  return format(subWeeks(parseISO(from), STREAK_LOOKBACK_WEEKS), 'yyyy-MM-dd');
}

/**
 * Habits that still count somewhere in [from, to] (not archived, or archived after `from`),
 * with their schedule versions and the checks from `checksFrom(from)` to `to`.
 * Pass `onlyId` to load a single habit (archived or not).
 */
export async function loadHabits(
  from: string,
  to: string,
  onlyId?: string,
): Promise<{ timezone: string; today: string; habits: HabitHistory[] }> {
  const profile = await ensureProfile();
  const today = todayIn(profile.timezone, new Date());
  const supabase = await createServerClient();

  let habitsQuery = supabase.from('habits').select('*').order('position').order('created_at');
  habitsQuery = onlyId
    ? habitsQuery.eq('id', onlyId)
    : habitsQuery.or(`archived_at.is.null,archived_at.gt.${from}`);
  const habitRows = await habitsQuery;
  if (habitRows.error) throw new Error(`Nie udało się wczytać nawyków: ${habitRows.error.message}`);
  const ids = habitRows.data.map((row) => row.id);
  if (ids.length === 0) return { timezone: profile.timezone, today, habits: [] };

  const scheduleRows = await supabase.from('habit_schedules').select('*').in('habit_id', ids);
  if (scheduleRows.error) throw new Error(`Nie udało się wczytać harmonogramów: ${scheduleRows.error.message}`);

  const checkDates = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await supabase
      .from('habit_checks')
      .select('habit_id, date')
      .in('habit_id', ids)
      .gte('date', checksFrom(from))
      .lte('date', to)
      .order('date')
      .order('habit_id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (page.error) throw new Error(`Nie udało się wczytać odhaczeń: ${page.error.message}`);
    for (const row of page.data) checkDates.get(row.habit_id)?.add(row.date);
    if (page.data.length < PAGE_SIZE) break;
  }

  const habits: HabitHistory[] = [];
  for (const row of habitRows.data) {
    const schedules = scheduleRows.data
      .filter((version) => version.habit_id === row.id)
      .map((version) => ({
        validFrom: version.valid_from,
        type: version.schedule_type,
        weekdays: version.weekdays ?? [],
        timesPerWeek: version.times_per_week,
      }))
      .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    if (schedules.length === 0) continue; // a habit without any schedule version cannot be shown or scored
    habits.push({
      id: row.id,
      name: row.name,
      createdOn: schedules[0].validFrom, // the habit's first version starts the day it was created
      archivedOn: row.archived_at,
      schedules,
      checks: checkDates.get(row.id) ?? new Set(),
    });
  }
  return { timezone: profile.timezone, today, habits };
}
