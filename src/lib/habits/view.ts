import { addDays, format, getISODay, isSameISOWeek, parseISO } from 'date-fns';
import { habitStreak, isPlannedOn, scheduleOn, weekProgress } from './schedule';
import type { HabitHistory, HabitSchedule } from './types';

const DAY_FORMAT = 'yyyy-MM-dd';
const WEEKDAY_CHIPS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']; // ISO 1..7

/** Polish noun form for a count: 1 → one, 2–4 (not 12–14) → few, otherwise → many. */
function pluralForm(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** „12 dni z rzędu”, „2 tygodnie z rzędu”. */
export function streakLabel(streak: { value: number; unit: 'days' | 'weeks' }): string {
  const noun =
    streak.unit === 'days'
      ? streak.value === 1
        ? 'dzień'
        : 'dni'
      : pluralForm(streak.value, 'tydzień', 'tygodnie', 'tygodni');
  return `${streak.value} ${noun} z rzędu`;
}

/** „środa, 18 listopada” (miesiąc w dopełniaczu). */
function weekdayAndDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** Napis nawigacji dnia: „Dziś · środa, 18 listopada” albo „Wtorek, 17 listopada”. */
export function dayHeading(date: string, today: string): string {
  return date === today ? `Dziś · ${weekdayAndDate(date)}` : capitalize(weekdayAndDate(date));
}

/** Tytuł karty listy: „Dzisiaj” albo nazwa dnia („Wtorek”). */
export function dayTitle(date: string, today: string): string {
  if (date === today) return 'Dzisiaj';
  return capitalize(new Date(`${date}T12:00:00Z`).toLocaleDateString('pl-PL', { weekday: 'long', timeZone: 'UTC' }));
}

export type DayRow = {
  habit: HabitHistory;
  /** Wersja harmonogramu obowiązująca tego dnia. */
  schedule: HabitSchedule;
  checked: boolean;
  /** Nawyk „w wybrane dni”, który tego dnia nie jest zaplanowany (na dole listy, przygaszony). */
  offDay: boolean;
  /** Napis po prawej: seria, postęp tygodnia, „bez planu” albo „nie dziś”; null = nic. */
  meta: string | null;
};

/**
 * Wiersze listy dnia `date`: tylko nawyki, które tego dnia istnieją (utworzone, niezarchiwizowane),
 * w kolejności z bazy, a nawyki „w wybrane dni” niezaplanowane na ten dzień na końcu.
 */
export function dayRows(habits: HabitHistory[], date: string, today: string): DayRow[] {
  const planned: DayRow[] = [];
  const offDays: DayRow[] = [];

  for (const habit of habits) {
    const schedule = scheduleOn(habit, date);
    if (schedule === null) continue;
    const checked = habit.checks.has(date);

    if (schedule.type === 'days' && !isPlannedOn(schedule, date)) {
      offDays.push({ habit, schedule, checked, offDay: true, meta: date === today ? 'nie dziś' : 'nie tego dnia' });
      continue;
    }

    let meta: string | null = null;
    if (schedule.type === 'none') meta = 'bez planu';
    else if (schedule.type === 'weekly') {
      const progress = weekProgress(habit, date);
      // Tydzień oglądanego dnia, który już minął, to „tamten”; wcześniejszy dzień tego tygodnia nadal „ten”.
      const week = isSameISOWeek(parseISO(date), parseISO(today)) ? 'w tym tyg.' : 'w tamtym tyg.';
      if (progress) meta = `${progress.done} z ${progress.target} ${week}`;
    } else {
      const streak = habitStreak(habit, date);
      if (streak && streak.value > 0) meta = streakLabel(streak);
    }
    planned.push({ habit, schedule, checked, offDay: false, meta });
  }

  return [...planned, ...offDays];
}

/**
 * Kolor dnia w heatmapie pojedynczego nawyku: odhaczony, zaplanowany i niezrobiony,
 * niezaplanowany (także przed utworzeniem / po archiwizacji i dni nawyku tygodniowego) albo przyszły.
 */
export function habitDayKind(habit: HabitHistory, date: string, today: string): 'done' | 'missed' | 'off' | 'future' {
  if (date > today) return 'future';
  if (habit.checks.has(date)) return 'done';
  const schedule = scheduleOn(habit, date);
  if (schedule !== null && isPlannedOn(schedule, date)) return 'missed';
  return 'off';
}

type ScheduleDraft = Omit<HabitSchedule, 'validFrom'>;

/** Podgląd najbliższych 14 dni (od jutra) dla harmonogramu z okna nawyku. */
export function schedulePreview(
  schedule: ScheduleDraft,
  today: string,
): { date: string; weekday: string; dayOfMonth: number; kind: 'planned' | 'loose' | 'off' }[] {
  const asVersion: HabitSchedule = { ...schedule, validFrom: today };
  return Array.from({ length: 14 }, (_, index) => {
    const day = addDays(parseISO(today), index + 1);
    const date = format(day, DAY_FORMAT);
    const kind = isPlannedOn(asVersion, date) ? 'planned' : schedule.type === 'weekly' ? 'loose' : 'off';
    return { date, weekday: WEEKDAY_CHIPS[getISODay(day) - 1], dayOfMonth: day.getDate(), kind };
  });
}

/** Podpis pod podglądem: „6 zaplanowanych dni”, „2 zaplanowane dni”, „6 razy w ciągu 2 tygodni, …”. */
export function previewNote(schedule: ScheduleDraft, today: string): string {
  if (schedule.type === 'none') return 'Brak zaplanowanych dni';
  if (schedule.type === 'weekly') return `${(schedule.timesPerWeek ?? 1) * 2} razy w ciągu 2 tygodni, dni wybierasz sam`;
  const count = schedulePreview(schedule, today).filter((day) => day.kind === 'planned').length;
  if (count === 0) return 'Brak zaplanowanych dni';
  const words = pluralForm(count, 'zaplanowany dzień', 'zaplanowane dni', 'zaplanowanych dni');
  return `${count} ${words}`;
}
