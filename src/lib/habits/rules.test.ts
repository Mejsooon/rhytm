import { describe, expect, it } from 'vitest';
import { assertCheckable, validateHabitInput } from './rules';
import type { HabitHistory } from './types';

const habit: HabitHistory = {
  id: 'h1',
  name: 'Czytanie',
  createdOn: '2026-11-05',
  archivedOn: '2026-11-12',
  schedules: [{ validFrom: '2026-11-05', type: 'daily', weekdays: [], timesPerWeek: null }],
  checks: new Set(),
};
const active: HabitHistory = { ...habit, archivedOn: null };

describe('assertCheckable', () => {
  it('odrzuca dzień w przyszłości', () => {
    expect(() => assertCheckable(active, '2026-11-15', '2026-11-14')).toThrow('Nie można odhaczyć nawyku w przyszłości');
  });

  it('odrzuca dzień przed utworzeniem nawyku', () => {
    expect(() => assertCheckable(active, '2026-11-04', '2026-11-14')).toThrow('Ten nawyk jeszcze wtedy nie istniał');
  });

  it('odrzuca dzień archiwizacji i późniejsze', () => {
    expect(() => assertCheckable(habit, '2026-11-12', '2026-11-14')).toThrow('Nawyk jest zarchiwizowany');
    expect(() => assertCheckable(habit, '2026-11-13', '2026-11-14')).toThrow('Nawyk jest zarchiwizowany');
  });

  it('przyjmuje poprawny dzień (także dziś i dzień przed archiwizacją)', () => {
    expect(() => assertCheckable(active, '2026-11-14', '2026-11-14')).not.toThrow();
    expect(() => assertCheckable(habit, '2026-11-11', '2026-11-14')).not.toThrow();
  });
});

describe('validateHabitInput', () => {
  const base = { name: 'Bieg', type: 'daily', weekdays: [], timesPerWeek: null };

  it('przycina nazwę i zwraca harmonogram daily bez dodatkowych pól', () => {
    expect(validateHabitInput({ ...base, name: '  Bieg ' })).toEqual({
      name: 'Bieg',
      schedule: { type: 'daily', weekdays: [], timesPerWeek: null },
    });
  });

  it('odrzuca pustą i zbyt długą nazwę', () => {
    expect(() => validateHabitInput({ ...base, name: '   ' })).toThrow('Nazwa nie może być pusta');
    expect(() => validateHabitInput({ ...base, name: 'a'.repeat(61) })).toThrow('Nazwa może mieć najwyżej 60 znaków');
    expect(validateHabitInput({ ...base, name: 'a'.repeat(60) }).name).toHaveLength(60);
  });

  it('days: sortuje dni i wymaga 1-7 unikalnych dni z zakresu 1-7', () => {
    expect(validateHabitInput({ ...base, type: 'days', weekdays: [5, 1, 3] }).schedule).toEqual({
      type: 'days',
      weekdays: [1, 3, 5],
      timesPerWeek: null,
    });
    for (const weekdays of [[], [0], [8], [1, 1], [1.5]]) {
      expect(() => validateHabitInput({ ...base, type: 'days', weekdays })).toThrow('Wybierz co najmniej jeden dzień');
    }
  });

  it('weekly: liczba razy 1-7', () => {
    expect(validateHabitInput({ ...base, type: 'weekly', timesPerWeek: 3 }).schedule).toEqual({
      type: 'weekly',
      weekdays: [],
      timesPerWeek: 3,
    });
    for (const timesPerWeek of [null, 0, 8, 2.5]) {
      expect(() => validateHabitInput({ ...base, type: 'weekly', timesPerWeek })).toThrow(
        'Liczba razy w tygodniu musi być od 1 do 7',
      );
    }
  });

  it('none jest poprawny, nieznany typ odrzucony', () => {
    expect(validateHabitInput({ ...base, type: 'none' }).schedule.type).toBe('none');
    expect(() => validateHabitInput({ ...base, type: 'monthly' })).toThrow('Nieznany harmonogram');
  });
});
