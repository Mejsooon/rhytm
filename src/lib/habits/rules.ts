import type { HabitHistory, HabitSchedule } from './types';

/** Throws a Polish error when `date` cannot be checked off for this habit. Dates are YYYY-MM-DD. */
export function assertCheckable(habit: HabitHistory, date: string, today: string): void {
  if (date > today) throw new Error('Nie można odhaczyć nawyku w przyszłości');
  if (date < habit.createdOn) throw new Error('Ten nawyk jeszcze wtedy nie istniał');
  if (habit.archivedOn !== null && date >= habit.archivedOn) throw new Error('Nawyk jest zarchiwizowany');
}

/** Validates form input; returns the trimmed name and a normalised schedule (without validFrom). */
export function validateHabitInput(input: {
  name: string;
  type: string;
  weekdays: number[];
  timesPerWeek: number | null;
}): { name: string; schedule: Omit<HabitSchedule, 'validFrom'> } {
  const name = input.name.trim();
  if (name.length === 0) throw new Error('Nazwa nie może być pusta');
  if (name.length > 60) throw new Error('Nazwa może mieć najwyżej 60 znaków');

  if (input.type === 'daily' || input.type === 'none') {
    return { name, schedule: { type: input.type, weekdays: [], timesPerWeek: null } };
  }

  if (input.type === 'days') {
    const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
    const valid = weekdays.length >= 1 && weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7);
    // Duplicates in the input mean a malformed request, not just a redundant one.
    if (!valid || weekdays.length !== input.weekdays.length) throw new Error('Wybierz co najmniej jeden dzień');
    return { name, schedule: { type: 'days', weekdays, timesPerWeek: null } };
  }

  if (input.type === 'weekly') {
    const times = input.timesPerWeek;
    if (times === null || !Number.isInteger(times) || times < 1 || times > 7) {
      throw new Error('Liczba razy w tygodniu musi być od 1 do 7');
    }
    return { name, schedule: { type: 'weekly', weekdays: [], timesPerWeek: times } };
  }

  throw new Error('Nieznany harmonogram');
}
