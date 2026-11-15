import { describe, expect, it } from 'vitest';
import {
  dayScore,
  habitStreak,
  isPlannedOn,
  scheduleLabel,
  scheduleOn,
  weekProgress,
} from './schedule';
import type { HabitHistory, HabitSchedule } from './types';

const daily: HabitSchedule = { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null };
const none: HabitSchedule = { validFrom: '2026-11-01', type: 'none', weekdays: [], timesPerWeek: null };
const weekly3: HabitSchedule = { validFrom: '2026-11-01', type: 'weekly', weekdays: [], timesPerWeek: 3 };

function habit(overrides: {
  createdOn?: string;
  archivedOn?: string | null;
  schedules?: HabitSchedule[];
  checks?: string[];
}): HabitHistory {
  return {
    id: 'h1',
    name: 'Nawyk',
    createdOn: overrides.createdOn ?? '2026-11-01',
    archivedOn: overrides.archivedOn ?? null,
    schedules: overrides.schedules ?? [daily],
    remindAt: null,
    checks: new Set(overrides.checks ?? []),
  };
}

function stretchWithChecks(checks: string[]): HabitHistory {
  return habit({ schedules: [weekly3], checks });
}

describe('scheduleOn', () => {
  const study = habit({
    schedules: [
      { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null },
      { validFrom: '2026-11-16', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null },
    ],
  });

  it('picks the version with the greatest validFrom <= date', () => {
    expect(scheduleOn(study, '2026-11-15')!.type).toBe('daily');
    expect(scheduleOn(study, '2026-11-16')!.type).toBe('days');
    expect(scheduleOn(study, '2026-12-30')!.type).toBe('days');
  });

  it('does not depend on the order of versions', () => {
    const reversed = habit({ schedules: [...study.schedules].reverse() });
    expect(scheduleOn(reversed, '2026-11-15')!.type).toBe('daily');
    expect(scheduleOn(reversed, '2026-11-20')!.type).toBe('days');
  });

  it('returns null before createdOn', () => {
    expect(scheduleOn(study, '2026-10-31')).toBeNull();
  });

  it('returns null on and after archivedOn, but not the day before', () => {
    const archived = habit({ archivedOn: '2026-11-10' });
    expect(scheduleOn(archived, '2026-11-09')).not.toBeNull();
    expect(scheduleOn(archived, '2026-11-10')).toBeNull();
    expect(scheduleOn(archived, '2026-11-11')).toBeNull();
  });

  it('returns null when no version is valid yet', () => {
    const late = habit({ schedules: [{ ...daily, validFrom: '2026-11-05' }] });
    expect(scheduleOn(late, '2026-11-03')).toBeNull();
  });
});

describe('isPlannedOn', () => {
  it('daily is always planned', () => {
    expect(isPlannedOn(daily, '2026-11-15')).toBe(true);
  });

  it('days uses the ISO weekday', () => {
    const monWedFri: HabitSchedule = { ...daily, type: 'days', weekdays: [1, 3, 5] };
    expect(isPlannedOn(monWedFri, '2026-11-16')).toBe(true); // Monday
    expect(isPlannedOn(monWedFri, '2026-11-17')).toBe(false); // Tuesday
    const sundayOnly: HabitSchedule = { ...daily, type: 'days', weekdays: [7] };
    expect(isPlannedOn(sundayOnly, '2026-11-15')).toBe(true); // Sunday = 7
  });

  it('weekly and none are never planned on a given day', () => {
    expect(isPlannedOn(weekly3, '2026-11-16')).toBe(false);
    expect(isPlannedOn(none, '2026-11-16')).toBe(false);
  });

  it('versioned schedule changes only apply from the change day', () => {
    const study = habit({
      schedules: [
        { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null },
        { validFrom: '2026-11-16', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null },
      ],
    });
    expect(isPlannedOn(scheduleOn(study, '2026-11-15')!, '2026-11-15')).toBe(true); // Sunday, old version
    expect(isPlannedOn(scheduleOn(study, '2026-11-22')!, '2026-11-22')).toBe(false); // Sunday, new version
  });
});

describe('dayScore', () => {
  const water = habit({ checks: ['2026-11-16'] });
  const stretch = habit({ schedules: [weekly3] });

  it('an unchecked weekly habit does not count', () => {
    expect(dayScore([water, stretch], '2026-11-16')).toEqual({ done: 1, total: 1, pct: 100 });
  });

  it('counts a planned unchecked habit in the denominator', () => {
    expect(dayScore([water, stretch], '2026-11-17')).toEqual({ done: 0, total: 1, pct: 0 });
  });

  it('a checked weekly habit counts as done and in total', () => {
    const stretchDone = habit({ schedules: [weekly3], checks: ['2026-11-17'] });
    expect(dayScore([water, stretchDone], '2026-11-17')).toEqual({ done: 1, total: 2, pct: 50 }); // water open
    expect(dayScore([water, stretchDone], '2026-11-16')).toEqual({ done: 1, total: 1, pct: 100 });
  });

  it('a checked "none" habit counts, an unchecked one does not', () => {
    const noPlanDone = habit({ schedules: [none], checks: ['2026-11-17'] });
    const noPlanOpen = habit({ schedules: [none] });
    expect(dayScore([noPlanDone], '2026-11-17')).toEqual({ done: 1, total: 1, pct: 100 });
    expect(dayScore([noPlanOpen], '2026-11-17').pct).toBeNull();
  });

  it('is null (not 0) when nothing is planned or checked', () => {
    expect(dayScore([habit({ schedules: [none] })], '2026-11-17')).toEqual({ done: 0, total: 0, pct: null });
    expect(dayScore([], '2026-11-17').pct).toBeNull();
  });

  it('is null before the habit was created', () => {
    expect(dayScore([water], '2026-10-31').pct).toBeNull();
  });

  it('ignores archived habits from the archive day on', () => {
    const archived = habit({ archivedOn: '2026-11-17' });
    expect(dayScore([archived], '2026-11-16').total).toBe(1);
    expect(dayScore([archived], '2026-11-17').total).toBe(0);
  });

  it('rounds the percentage to an integer', () => {
    const a = habit({ checks: ['2026-11-17'] });
    const b = habit({});
    const c = habit({});
    expect(dayScore([a, b, c], '2026-11-17')).toEqual({ done: 1, total: 3, pct: 33 });
    const d = habit({ checks: ['2026-11-17'] });
    expect(dayScore([a, d, b], '2026-11-17')).toEqual({ done: 2, total: 3, pct: 67 });
  });

  it('past days keep the schedule valid at that time', () => {
    const study = habit({
      schedules: [
        { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null },
        { validFrom: '2026-11-16', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null },
      ],
    });
    expect(dayScore([study], '2026-11-15')).toEqual({ done: 0, total: 1, pct: 0 }); // Sunday, old version
    expect(dayScore([study], '2026-11-22').pct).toBeNull(); // Sunday, new version
  });
});

describe('habitStreak', () => {
  it('counts consecutive done days; an undone today does not break it', () => {
    const h = habit({ checks: ['2026-11-16', '2026-11-17'] });
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 2, unit: 'days' });
  });

  it('includes today when done', () => {
    const h = habit({ checks: ['2026-11-16', '2026-11-17', '2026-11-18'] });
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 3, unit: 'days' });
  });

  it('breaks on a planned, undone past day', () => {
    const h = habit({ checks: ['2026-11-14', '2026-11-16', '2026-11-17'] });
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 2, unit: 'days' });
  });

  it('is 0 when yesterday was missed', () => {
    const h = habit({ checks: ['2026-11-15'] });
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 0, unit: 'days' });
  });

  it('stops at the creation day', () => {
    const h = habit({ createdOn: '2026-11-16', schedules: [{ ...daily, validFrom: '2026-11-16' }], checks: ['2026-11-16', '2026-11-17'] });
    expect(habitStreak(h, '2026-11-17')).toEqual({ value: 2, unit: 'days' });
  });

  it('days schedule: only planned days count, others are skipped', () => {
    const monWedFri: HabitSchedule = { validFrom: '2026-11-01', type: 'days', weekdays: [1, 3, 5], timesPerWeek: null };
    // Fri 13, Mon 16 done; Sat/Sun/Tue/Wed? today is Tue 17 (not planned)
    const h = habit({ schedules: [monWedFri], checks: ['2026-11-13', '2026-11-16'] });
    expect(habitStreak(h, '2026-11-17')).toEqual({ value: 2, unit: 'days' });
  });

  it('days schedule: a missed planned day breaks the streak', () => {
    const monWedFri: HabitSchedule = { validFrom: '2026-11-01', type: 'days', weekdays: [1, 3, 5], timesPerWeek: null };
    const h = habit({ schedules: [monWedFri], checks: ['2026-11-13', '2026-11-16'] });
    // today Thu 19: Wed 18 planned and missed
    expect(habitStreak(h, '2026-11-19')).toEqual({ value: 0, unit: 'days' });
  });

  it('weekly: counts completed weeks, the current unfinished week does not break it', () => {
    const h = stretchWithChecks([
      '2026-11-02', '2026-11-04', '2026-11-06', // week 2-8 Nov: 3
      '2026-11-09', '2026-11-11', '2026-11-13', // week 9-15 Nov: 3
      '2026-11-16', // current week 16-22 Nov: 1
    ]);
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 2, unit: 'weeks' });
  });

  it('weekly: the current week counts once it reaches the target', () => {
    const h = stretchWithChecks([
      '2026-11-09', '2026-11-11', '2026-11-13',
      '2026-11-16', '2026-11-17', '2026-11-18',
    ]);
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 2, unit: 'weeks' });
  });

  it('weekly: a failed past week breaks the streak', () => {
    const h = stretchWithChecks([
      '2026-11-02', '2026-11-04', '2026-11-06',
      '2026-11-09', '2026-11-11', // only 2 in week 9-15
      '2026-11-16',
    ]);
    expect(habitStreak(h, '2026-11-18')).toEqual({ value: 0, unit: 'weeks' });
  });

  it('weekly: stops at the week of creation', () => {
    const h = stretchWithChecks(['2026-11-02', '2026-11-04', '2026-11-06']);
    expect(habitStreak(h, '2026-11-10')).toEqual({ value: 1, unit: 'weeks' });
  });

  it('is null for "none" and when the habit has no schedule today', () => {
    expect(habitStreak(habit({ schedules: [none] }), '2026-11-18')).toBeNull();
    expect(habitStreak(habit({ archivedOn: '2026-11-10' }), '2026-11-18')).toBeNull();
    expect(habitStreak(habit({}), '2026-10-30')).toBeNull();
  });

  it('a schedule change keeps the streak from before the change', () => {
    const h = habit({
      schedules: [
        { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null },
        { validFrom: '2026-11-16', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null },
      ],
      // Fri 13, Sat 14, Sun 15 done under "daily"; Mon 16 - Fri 20 under the new schedule.
      checks: ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'],
    });
    expect(habitStreak(h, '2026-11-16')).toEqual({ value: 4, unit: 'days' });
    // Sat 21 / Sun 22 are not planned any more and are skipped, not counted.
    expect(habitStreak(h, '2026-11-22')).toEqual({ value: 8, unit: 'days' });
  });
});

describe('weekProgress', () => {
  it('counts checks in the Monday-Sunday week containing the date', () => {
    expect(weekProgress(stretchWithChecks(['2026-11-16']), '2026-11-18')).toEqual({ done: 1, target: 3 });
  });

  it('ignores checks from neighbouring weeks', () => {
    const h = stretchWithChecks(['2026-11-15', '2026-11-16', '2026-11-22', '2026-11-23']);
    expect(weekProgress(h, '2026-11-18')).toEqual({ done: 2, target: 3 });
  });

  it('treats Sunday as the last day of the week', () => {
    const h = stretchWithChecks(['2026-11-16', '2026-11-22']);
    expect(weekProgress(h, '2026-11-22')).toEqual({ done: 2, target: 3 });
  });

  it('is null for non-weekly habits and for dates without a schedule', () => {
    expect(weekProgress(habit({}), '2026-11-18')).toBeNull();
    expect(weekProgress(habit({ schedules: [none] }), '2026-11-18')).toBeNull();
    expect(weekProgress(stretchWithChecks([]), '2026-10-30')).toBeNull();
  });
});

describe('scheduleLabel', () => {
  const base = { validFrom: 'x', timesPerWeek: null };

  it('labels each schedule type', () => {
    expect(scheduleLabel({ ...base, type: 'daily', weekdays: [] })).toBe('codziennie');
    expect(scheduleLabel({ ...base, type: 'none', weekdays: [] })).toBe('bez planu');
    expect(scheduleLabel({ validFrom: 'x', type: 'weekly', weekdays: [], timesPerWeek: 3 })).toBe('3× w tygodniu');
  });

  it('labels days', () => {
    expect(scheduleLabel({ ...base, type: 'days', weekdays: [1, 2, 3, 4, 5] })).toBe('pon–pt');
    expect(scheduleLabel({ ...base, type: 'days', weekdays: [5, 1, 3] })).toBe('pn, śr, pt');
    expect(scheduleLabel({ ...base, type: 'days', weekdays: [2, 4, 6, 7] })).toBe('wt, czw, sob, nd');
    expect(scheduleLabel({ ...base, type: 'days', weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('codziennie');
    expect(scheduleLabel({ ...base, type: 'days', weekdays: [6, 7] })).toBe('sob, nd');
  });
});
