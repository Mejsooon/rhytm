import { addDays, addMonths, format, isValid, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { heatmapDays } from '../habits/heatmap';
import type { HeatRange } from '../habits/heatmap';

export type SleepLog = { date: string; sleptAt: string; wokeAt: string; feeling: number; note: string | null };

export type SleepBar = {
  key: string;
  label: string;
  title: string;
  minutes: number | null;
  metGoal: boolean;
  latest: boolean;
};

const DAY_FORMAT = 'yyyy-MM-dd';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_SLEEP_MINUTES = 30;
const MAX_SLEEP_MINUTES = 16 * 60;
const MONTH_SHORT_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/**
 * Minutes slept in the night that ended on `date` (the wake-up day). When
 * `sleptAt` is not before `wokeAt` the sleep started the previous day. The
 * difference is taken between real instants, so DST changes are counted.
 */
export function sleepMinutes(date: string, sleptAt: string, wokeAt: string, timezone: string): number {
  const sleepDate = sleptAt >= wokeAt ? format(addDays(parseISO(date), -1), DAY_FORMAT) : date;
  const start = fromZonedTime(`${sleepDate}T${sleptAt}:00`, timezone);
  const end = fromZonedTime(`${date}T${wokeAt}:00`, timezone);

  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function formatMinutes(min: number): string {
  const hours = Math.floor(min / 60);
  const minutes = min % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

export function validateSleepInput(
  input: { date: string; sleptAt: string; wokeAt: string; feeling: number; note: string },
  timezone: string,
  today: string,
): SleepLog {
  const parsedDate = parseISO(input.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !isValid(parsedDate) || format(parsedDate, DAY_FORMAT) !== input.date) {
    throw new Error('Nieprawidłowa data');
  }
  if (!TIME_PATTERN.test(input.sleptAt) || !TIME_PATTERN.test(input.wokeAt)) {
    throw new Error('Nieprawidłowa godzina');
  }
  if (input.date > today) {
    throw new Error('Nie można zapisać snu z przyszłości');
  }

  const minutes = sleepMinutes(input.date, input.sleptAt, input.wokeAt, timezone);
  if (minutes < MIN_SLEEP_MINUTES || minutes > MAX_SLEEP_MINUTES) {
    throw new Error('Sen musi trwać od 30 minut do 16 godzin');
  }
  if (!Number.isInteger(input.feeling) || input.feeling < 1 || input.feeling > 5) {
    throw new Error('Samopoczucie musi być od 1 do 5');
  }

  const note = input.note.trim();
  if ([...note].length > 500) {
    throw new Error('Notatka może mieć najwyżej 500 znaków');
  }

  return { date: input.date, sleptAt: input.sleptAt, wokeAt: input.wokeAt, feeling: input.feeling, note: note === '' ? null : note };
}

/**
 * Chart bars, oldest first, the last one being the newest. `month` = the last
 * 30 nights; `quarter`/`half` = mean per ISO week (13/26 weeks ending with the
 * current one); `year` = mean per calendar month (12 months ending with the
 * current one).
 */
export function sleepBars(logs: SleepLog[], range: HeatRange, today: string, timezone: string, goalMin: number): SleepBar[] {
  const minutesByDate = new Map(logs.map((entry) => [entry.date, sleepMinutes(entry.date, entry.sleptAt, entry.wokeAt, timezone)]));

  // One group of dates per bar; a bar's minutes are the rounded mean over the dates that have a log.
  let groups: { key: string; label: string; name: string; dates: string[] }[];

  if (range === 'month') {
    groups = Array.from({ length: 30 }, (_, index) => {
      const daysBack = 29 - index;
      const day = addDays(parseISO(today), -daysBack);
      const date = format(day, DAY_FORMAT);
      const showLabel = index === 0 || daysBack % 5 === 0;

      return { key: date, label: showLabel ? String(day.getDate()) : '', name: `${day.getDate()} ${MONTH_SHORT_NAMES[day.getMonth()]}`, dates: [date] };
    });
  } else if (range === 'year') {
    const currentMonth = parseISO(`${today.slice(0, 7)}-01`);
    groups = Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(currentMonth, index - 11);
      const key = format(month, 'yyyy-MM');
      const monthName = MONTH_SHORT_NAMES[month.getMonth()];
      const dates = [...minutesByDate.keys()].filter((date) => date.startsWith(key));

      return { key, label: monthName, name: `${monthName} ${month.getFullYear()}`, dates };
    });
  } else {
    const { weeks } = heatmapDays(range, today);
    groups = weeks.map((week, index) => {
      const monday = parseISO(week[0]);
      const showLabel = range === 'quarter' || (weeks.length - 1 - index) % 2 === 0;

      return {
        key: week[0],
        label: showLabel ? `${monday.getDate()}.${monday.getMonth() + 1}` : '',
        name: `tydzień od ${monday.getDate()} ${MONTH_SHORT_NAMES[monday.getMonth()]}`,
        dates: week,
      };
    });
  }

  return groups.map((group, index) => {
    const values = group.dates.flatMap((date) => minutesByDate.get(date) ?? []);
    const minutes = values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const average = range === 'month' ? '' : 'średnio ';

    return {
      key: group.key,
      label: group.label,
      title: `${group.name} · ${minutes === null ? 'brak wpisu' : average + formatMinutes(minutes)}`,
      minutes,
      metGoal: minutes !== null && minutes >= goalMin,
      latest: index === groups.length - 1,
    };
  });
}

/**
 * Averages over the logs dated `from`..`to` inclusive. Bedtimes before 12:00
 * count as the next day (+24 h) so 23:50 and 00:10 average to 00:00.
 */
export function sleepStats(
  logs: SleepLog[],
  from: string,
  to: string,
  timezone: string,
): { avgMinutes: number | null; avgBedtime: string | null; avgFeeling: number | null } {
  const inRange = logs.filter((entry) => entry.date >= from && entry.date <= to);

  if (inRange.length === 0) return { avgMinutes: null, avgBedtime: null, avgFeeling: null };

  let minutesSum = 0;
  let bedtimeSum = 0;
  let feelingSum = 0;

  for (const entry of inRange) {
    const [hours, minutes] = entry.sleptAt.split(':').map(Number);
    const bedtime = hours * 60 + minutes;

    minutesSum += sleepMinutes(entry.date, entry.sleptAt, entry.wokeAt, timezone);
    bedtimeSum += bedtime < 12 * 60 ? bedtime + 24 * 60 : bedtime;
    feelingSum += entry.feeling;
  }

  const avgBedtime = Math.round(bedtimeSum / inRange.length) % (24 * 60);

  return {
    avgMinutes: Math.round(minutesSum / inRange.length),
    avgBedtime: `${String(Math.floor(avgBedtime / 60)).padStart(2, '0')}:${String(avgBedtime % 60).padStart(2, '0')}`,
    avgFeeling: Math.round((feelingSum / inRange.length) * 10) / 10,
  };
}
