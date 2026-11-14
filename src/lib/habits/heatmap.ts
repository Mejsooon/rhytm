import { addDays, format, parseISO, startOfISOWeek, startOfMonth } from 'date-fns';
import { dayScore } from './schedule';
import type { HabitHistory } from './types';

export type HeatRange = 'month' | 'quarter' | 'half' | 'year';

const DAY_FORMAT = 'yyyy-MM-dd';
const WEEKS_IN_RANGE = { quarter: 13, half: 26, year: 53 };
const MONTH_SHORT_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/**
 * Week columns (Mon-Sun) ending with the week that contains `today`. Days after
 * `today` in the last column are still listed; the UI greys them out.
 * A column gets a month label when its Monday is in a different month than the
 * previous column's Monday; the first column is always labelled.
 */
export function heatmapDays(
  range: Exclude<HeatRange, 'month'>,
  today: string,
): { weeks: string[][]; monthLabels: { col: number; label: string }[] } {
  const columnCount = WEEKS_IN_RANGE[range];
  const lastMonday = startOfISOWeek(parseISO(today));
  const weeks: string[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let previousMonth = -1;

  for (let col = 0; col < columnCount; col += 1) {
    const monday = addDays(lastMonday, (col - (columnCount - 1)) * 7);

    weeks.push(Array.from({ length: 7 }, (_, offset) => format(addDays(monday, offset), DAY_FORMAT)));

    if (monday.getMonth() !== previousMonth) {
      monthLabels.push({ col, label: MONTH_SHORT_NAMES[monday.getMonth()] });
      previousMonth = monday.getMonth();
    }
  }

  return { weeks, monthLabels };
}

/** 6x7 calendar grid for the month of `today`, starting on the Monday of the week with the 1st. */
export function monthCalendarDays(today: string): { date: string; inMonth: boolean }[] {
  const monthStart = startOfMonth(parseISO(today));
  const gridStart = startOfISOWeek(monthStart);

  return Array.from({ length: 42 }, (_, index) => {
    const day = addDays(gridStart, index);
    return { date: format(day, DAY_FORMAT), inMonth: day.getMonth() === monthStart.getMonth() };
  });
}

export function heatLevel(pct: number | null): 'empty' | 'zero' | 1 | 2 | 3 | 4 {
  if (pct === null) return 'empty';
  if (pct === 0) return 'zero';
  if (pct < 40) return 1;
  if (pct < 70) return 2;
  if (pct < 100) return 3;
  return 4;
}

/**
 * Stats for days `from`..`to` inclusive (caller passes `to` <= today): average
 * of the days that have a score, and the longest run of consecutive 100% days.
 */
export function heatStats(
  habits: HabitHistory[],
  from: string,
  to: string,
): { avgPct: number | null; bestRun: number } {
  let scoredDays = 0;
  let pctSum = 0;
  let bestRun = 0;
  let currentRun = 0;

  for (let day = parseISO(from); format(day, DAY_FORMAT) <= to; day = addDays(day, 1)) {
    const { pct } = dayScore(habits, format(day, DAY_FORMAT));

    if (pct !== null) {
      scoredDays += 1;
      pctSum += pct;
    }

    currentRun = pct === 100 ? currentRun + 1 : 0;
    bestRun = Math.max(bestRun, currentRun);
  }

  return { avgPct: scoredDays === 0 ? null : Math.round(pctSum / scoredDays), bestRun };
}
