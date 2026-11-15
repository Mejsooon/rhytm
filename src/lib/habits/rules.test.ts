import { describe, expect, it } from 'vitest';
import { assertCheckable, assertValidDate, validateHabitInput } from './rules';
import type { HabitHistory } from './types';

const habit: HabitHistory = {
  id: 'h1',
  name: 'Czytanie',
  createdOn: '2026-11-05',
  archivedOn: '2026-11-12',
  schedules: [{ validFrom: '2026-11-05', type: 'daily', weekdays: [], timesPerWeek: null }],
  remindAt: null,
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
      remindAt: null,
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

describe('validateHabitInput - godzina przypomnienia', () => {
  const base = { name: 'Bieg', type: 'daily', weekdays: [], timesPerWeek: null };

  it('przyjmuje HH:mm, null i brak pola (jako null)', () => {
    expect(validateHabitInput({ ...base, remindAt: '07:30' }).remindAt).toBe('07:30');
    expect(validateHabitInput({ ...base, remindAt: '00:00' }).remindAt).toBe('00:00');
    expect(validateHabitInput({ ...base, remindAt: '23:59' }).remindAt).toBe('23:59');
    expect(validateHabitInput({ ...base, remindAt: null }).remindAt).toBeNull();
    expect(validateHabitInput(base).remindAt).toBeNull();
  });

  it('odrzuca złe formaty i liczby', () => {
    for (const remindAt of ['7:30', '24:00', '07:60', '07:30:00', '', 'abc', 730]) {
      expect(() => validateHabitInput({ ...base, remindAt: remindAt as never })).toThrow('Nieprawidłowa godzina przypomnienia');
    }
  });

  it('typ none zeruje godzinę', () => {
    expect(validateHabitInput({ ...base, type: 'none', remindAt: '08:00' }).remindAt).toBeNull();
  });
});

describe('validateHabitInput - nieprawidłowe dane', () => {
  it('odrzuca wejście o złym kształcie', () => {
    const bad = [null, 'x', { name: 5, type: 'daily', weekdays: [], timesPerWeek: null }, { name: 'a', type: 'days', weekdays: 'x', timesPerWeek: null }];
    for (const input of bad) {
      expect(() => validateHabitInput(input as never)).toThrow('Nieprawidłowe dane');
    }
  });
});

describe('assertValidDate', () => {
  it('przyjmuje prawdziwy dzień, także 29 lutego w roku przestępnym', () => {
    expect(() => assertValidDate('2026-11-14')).not.toThrow();
    expect(() => assertValidDate('2028-02-29')).not.toThrow();
  });

  it('odrzuca nieistniejące dni i złe formaty', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2027-02-29', '2026-1-1', "2026-01-01,archived_at.is.null", '', null, 5]) {
      expect(() => assertValidDate(date)).toThrow('Nieprawidłowa data');
    }
  });
});
