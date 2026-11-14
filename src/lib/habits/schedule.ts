import { addDays, format, getISODay, parseISO, startOfISOWeek } from 'date-fns';
import type { HabitHistory, HabitSchedule } from './types';

const DAY_FORMAT = 'yyyy-MM-dd';
const WEEKDAY_SHORT_NAMES = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd']; // ISO 1..7

/** Schedule version in force on `date`, or null when the habit does not exist that day. */
export function scheduleOn(habit: HabitHistory, date: string): HabitSchedule | null {
  if (date < habit.createdOn) return null;
  if (habit.archivedOn !== null && date >= habit.archivedOn) return null;

  let current: HabitSchedule | null = null;
  for (const version of habit.schedules) {
    if (version.validFrom <= date && (current === null || version.validFrom > current.validFrom)) {
      current = version;
    }
  }
  return current;
}

/** Whether a daily/days schedule expects the habit on `date`. Weekly and none never do. */
export function isPlannedOn(schedule: HabitSchedule, date: string): boolean {
  if (schedule.type === 'daily') return true;
  if (schedule.type === 'days') return schedule.weekdays.includes(getISODay(parseISO(date)));
  return false;
}

/**
 * Day percentage. Planned (daily/days) habits count when planned; weekly and
 * "none" habits count only when checked off that day. No counted habit -> pct null.
 */
export function dayScore(
  habits: HabitHistory[],
  date: string,
): { done: number; total: number; pct: number | null } {
  let done = 0;
  let total = 0;

  for (const habit of habits) {
    const schedule = scheduleOn(habit, date);
    if (schedule === null) continue;

    const checked = habit.checks.has(date);
    if (isPlannedOn(schedule, date)) {
      total += 1;
      if (checked) done += 1;
    } else if ((schedule.type === 'weekly' || schedule.type === 'none') && checked) {
      total += 1;
      done += 1;
    }
  }

  return { done, total, pct: total === 0 ? null : Math.round((done / total) * 100) };
}

/**
 * Current streak. daily/days: consecutive planned days done, counting back from
 * today (an undone today does not break it). weekly: consecutive weeks (Mon-Sun)
 * with checks >= target (the unfinished current week does not break it).
 * null for "none" or when the habit has no schedule today.
 */
export function habitStreak(
  habit: HabitHistory,
  today: string,
): { value: number; unit: 'days' | 'weeks' } | null {
  const todaySchedule = scheduleOn(habit, today);
  if (todaySchedule === null || todaySchedule.type === 'none') return null;

  if (todaySchedule.type === 'weekly') {
    let weeks = 0;
    let weekStart = startOfISOWeek(parseISO(today));

    while (true) {
      const weekEnd = format(addDays(weekStart, 6), DAY_FORMAT);
      const schedule = scheduleOn(habit, weekEnd < today ? weekEnd : today);
      if (schedule === null || schedule.type !== 'weekly') break;

      let checksInWeek = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        if (habit.checks.has(format(addDays(weekStart, offset), DAY_FORMAT))) checksInWeek += 1;
      }

      const isCurrentWeek = weekEnd >= today;
      if (checksInWeek >= (schedule.timesPerWeek ?? 1)) weeks += 1;
      else if (!isCurrentWeek) break;

      weekStart = addDays(weekStart, -7);
    }
    return { value: weeks, unit: 'weeks' };
  }

  let days = 0;
  let cursor = parseISO(today);

  while (true) {
    const day = format(cursor, DAY_FORMAT);
    const schedule = scheduleOn(habit, day);
    if (schedule === null) break;

    if (isPlannedOn(schedule, day)) {
      if (habit.checks.has(day)) days += 1;
      else if (day !== today) break;
    }
    cursor = addDays(cursor, -1);
  }
  return { value: days, unit: 'days' };
}

/** Checks so far in the Mon-Sun week containing `date`; only for weekly habits. */
export function weekProgress(
  habit: HabitHistory,
  date: string,
): { done: number; target: number } | null {
  const schedule = scheduleOn(habit, date);
  if (schedule === null || schedule.type !== 'weekly') return null;

  const weekStart = startOfISOWeek(parseISO(date));
  let done = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    if (habit.checks.has(format(addDays(weekStart, offset), DAY_FORMAT))) done += 1;
  }
  return { done, target: schedule.timesPerWeek ?? 1 };
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.type === 'daily') return 'codziennie';
  if (schedule.type === 'none') return 'bez planu';
  if (schedule.type === 'weekly') return `${schedule.timesPerWeek ?? 1}× w tygodniu`;

  const weekdays = [...new Set(schedule.weekdays)].sort((a, b) => a - b);
  if (weekdays.length === 0) return 'bez planu';
  if (weekdays.length === 7) return 'codziennie';
  if (weekdays.length === 5 && weekdays.every((weekday, index) => weekday === index + 1)) return 'pon–pt';
  return weekdays.map((weekday) => WEEKDAY_SHORT_NAMES[weekday - 1]).join(', ');
}
