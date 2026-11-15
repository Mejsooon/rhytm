import { describe, expect, it } from 'vitest';
import {
  dayHeading,
  dayRows,
  dayTitle,
  habitDayKind,
  previewNote,
  schedulePreview,
  streakLabel,
} from './view';
import type { HabitHistory, HabitSchedule } from './types';

const daily: HabitSchedule = { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null };
const weekdaysOnly: HabitSchedule = { validFrom: '2026-11-01', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null };
const weekly3: HabitSchedule = { validFrom: '2026-11-01', type: 'weekly', weekdays: [], timesPerWeek: 3 };
const none: HabitSchedule = { validFrom: '2026-11-01', type: 'none', weekdays: [], timesPerWeek: null };

function habit(id: string, schedule: HabitSchedule, checks: string[] = [], archivedOn: string | null = null): HabitHistory {
  return { id, name: id, createdOn: '2026-11-01', archivedOn, schedules: [schedule], remindAt: null, checks: new Set(checks) };
}

describe('streakLabel', () => {
  it('odmienia dni', () => {
    expect(streakLabel({ value: 1, unit: 'days' })).toBe('1 dzień z rzędu');
    expect(streakLabel({ value: 2, unit: 'days' })).toBe('2 dni z rzędu');
    expect(streakLabel({ value: 12, unit: 'days' })).toBe('12 dni z rzędu');
  });

  it('odmienia tygodnie', () => {
    expect(streakLabel({ value: 1, unit: 'weeks' })).toBe('1 tydzień z rzędu');
    expect(streakLabel({ value: 2, unit: 'weeks' })).toBe('2 tygodnie z rzędu');
    expect(streakLabel({ value: 5, unit: 'weeks' })).toBe('5 tygodni z rzędu');
    expect(streakLabel({ value: 12, unit: 'weeks' })).toBe('12 tygodni z rzędu');
    expect(streakLabel({ value: 22, unit: 'weeks' })).toBe('22 tygodnie z rzędu');
  });
});

describe('dayHeading / dayTitle', () => {
  it('dziś: „Dziś · środa, 18 listopada” i „Dzisiaj”', () => {
    expect(dayHeading('2026-11-18', '2026-11-18')).toBe('Dziś · środa, 18 listopada');
    expect(dayTitle('2026-11-18', '2026-11-18')).toBe('Dzisiaj');
  });

  it('inny dzień: „Wtorek, 17 listopada” i nazwa dnia', () => {
    expect(dayHeading('2026-11-17', '2026-11-18')).toBe('Wtorek, 17 listopada');
    expect(dayTitle('2026-11-17', '2026-11-18')).toBe('Wtorek');
  });
});

describe('dayRows', () => {
  // 2026-11-14 to sobota, 2026-11-18 środa.
  it('pokazuje tylko nawyki istniejące tego dnia, niezaplanowane na dole z dopiskiem', () => {
    const habits = [
      habit('nauka', weekdaysOnly),
      habit('woda', daily),
      habit('stary', daily, [], '2026-11-10'),
    ];
    const rows = dayRows(habits, '2026-11-14', '2026-11-14');
    expect(rows.map((row) => row.habit.id)).toEqual(['woda', 'nauka']);
    expect(rows[1]).toMatchObject({ offDay: true, meta: 'nie dziś' });
    expect(rows[0].offDay).toBe(false);
  });

  it('w dzień inny niż dziś dopisek brzmi „nie tego dnia”', () => {
    const rows = dayRows([habit('nauka', weekdaysOnly)], '2026-11-15', '2026-11-18');
    expect(rows[0].meta).toBe('nie tego dnia');
  });

  it('meta: seria, postęp tygodnia i „bez planu”; seria 0 bez napisu', () => {
    const habits = [
      habit('woda', daily, ['2026-11-16', '2026-11-17']),
      habit('czytanie', daily),
      habit('rozciaganie', weekly3, ['2026-11-16', '2026-11-18']),
      habit('telefon', none),
    ];
    const rows = dayRows(habits, '2026-11-18', '2026-11-18');
    expect(rows.map((row) => row.meta)).toEqual(['2 dni z rzędu', null, '2 z 3 w tym tyg.', 'bez planu']);
    expect(rows[2].checked).toBe(true);
    expect(rows[0].checked).toBe(false);
  });
});

describe('dayRows — postęp tygodnia w innym tygodniu', () => {
  const stretch = habit('rozciaganie', weekly3, ['2026-11-10', '2026-11-16']);

  it('dzień z wcześniejszego tygodnia: „w tamtym tyg.”', () => {
    expect(dayRows([stretch], '2026-11-12', '2026-11-18')[0].meta).toBe('1 z 3 w tamtym tyg.');
  });

  it('wcześniejszy dzień bieżącego tygodnia: nadal „w tym tyg.”', () => {
    expect(dayRows([stretch], '2026-11-16', '2026-11-18')[0].meta).toBe('1 z 3 w tym tyg.');
  });
});

describe('habitDayKind', () => {
  const study = habit('nauka', weekdaysOnly, ['2026-11-16']);

  it('odhaczony, zaplanowany niezrobiony, niezaplanowany i przyszły', () => {
    expect(habitDayKind(study, '2026-11-16', '2026-11-18')).toBe('done');
    expect(habitDayKind(study, '2026-11-17', '2026-11-18')).toBe('missed');
    expect(habitDayKind(study, '2026-11-15', '2026-11-18')).toBe('off');
    expect(habitDayKind(study, '2026-10-30', '2026-11-18')).toBe('off');
    expect(habitDayKind(study, '2026-11-19', '2026-11-18')).toBe('future');
  });

  it('nawyk tygodniowy bez odhaczenia to dzień niezaplanowany', () => {
    expect(habitDayKind(habit('r', weekly3), '2026-11-17', '2026-11-18')).toBe('off');
  });
});

describe('schedulePreview / previewNote', () => {
  it('14 dni od jutra z rodzajem dnia', () => {
    const days = schedulePreview({ type: 'days', weekdays: [1, 3], timesPerWeek: null }, '2026-11-18');
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ date: '2026-11-19', weekday: 'Cz', dayOfMonth: 19, kind: 'off' });
    expect(days[4]).toEqual({ date: '2026-11-23', weekday: 'Pn', dayOfMonth: 23, kind: 'planned' });
    expect(days.filter((day) => day.kind === 'planned')).toHaveLength(4);
    expect(schedulePreview({ type: 'weekly', weekdays: [], timesPerWeek: 3 }, '2026-11-18')[0].kind).toBe('loose');
    expect(schedulePreview({ type: 'none', weekdays: [], timesPerWeek: null }, '2026-11-18')[0].kind).toBe('off');
  });

  it('podpis podglądu z odmianą', () => {
    expect(previewNote({ type: 'daily', weekdays: [], timesPerWeek: null }, '2026-11-18')).toBe('14 zaplanowanych dni');
    expect(previewNote({ type: 'days', weekdays: [1], timesPerWeek: null }, '2026-11-18')).toBe('2 zaplanowane dni');
    expect(previewNote({ type: 'days', weekdays: [1, 3, 5], timesPerWeek: null }, '2026-11-18')).toBe(
      '6 zaplanowanych dni',
    );
    expect(previewNote({ type: 'weekly', weekdays: [], timesPerWeek: 3 }, '2026-11-18')).toBe(
      '6 razy w ciągu 2 tygodni, dni wybierasz sam',
    );
    expect(previewNote({ type: 'none', weekdays: [], timesPerWeek: null }, '2026-11-18')).toBe('Brak zaplanowanych dni');
  });
});
