import { describe, expect, it } from 'vitest';
import { heatLevel, heatmapDays, heatStats, monthCalendarDays } from './heatmap';
import type { HabitHistory } from './types';

function dailyHabit(id: string, checks: string[]): HabitHistory {
  return {
    id,
    name: id,
    createdOn: '2026-01-01',
    archivedOn: null,
    schedules: [{ validFrom: '2026-01-01', type: 'daily', weekdays: [], timesPerWeek: null }],
    remindAt: null,
    checks: new Set(checks),
  };
}

describe('heatmapDays', () => {
  it('builds 13 Monday-Sunday columns for quarter, the last one containing today', () => {
    const { weeks, monthLabels } = heatmapDays('quarter', '2026-11-18');

    expect(weeks).toHaveLength(13);
    expect(weeks[12][0]).toBe('2026-11-16');
    expect(weeks[12][6]).toBe('2026-11-22');
    expect(weeks[12]).toContain('2026-11-18');
    expect(weeks[0][0]).toBe('2026-08-24');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(monthLabels[0]).toEqual({ col: 0, label: 'sie' });
  });

  it('uses 26 and 53 columns for half and year', () => {
    expect(heatmapDays('half', '2026-11-18').weeks).toHaveLength(26);
    expect(heatmapDays('year', '2026-11-18').weeks).toHaveLength(53);
  });

  it('labels a column only when its Monday starts a new month', () => {
    const { monthLabels } = heatmapDays('quarter', '2026-11-18');

    expect(monthLabels).toEqual([
      { col: 0, label: 'sie' },
      { col: 2, label: 'wrz' }, // Monday 2026-08-31 is still sie, 2026-09-07 is wrz
      { col: 6, label: 'paź' }, // 2026-10-05
      { col: 10, label: 'lis' }, // 2026-11-02
    ]);
  });

  it('works across a year boundary', () => {
    const { weeks, monthLabels } = heatmapDays('quarter', '2027-01-05');

    expect(weeks[12][0]).toBe('2027-01-04');
    expect(monthLabels.map((label) => label.label)).toContain('sty');
  });
});

describe('monthCalendarDays', () => {
  it('returns 42 days starting on the Monday of the week with the 1st', () => {
    const days = monthCalendarDays('2026-11-18');

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(days[6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(days[35]).toEqual({ date: '2026-11-30', inMonth: true });
    expect(days[36]).toEqual({ date: '2026-12-01', inMonth: false });
    expect(days.filter((day) => day.inMonth)).toHaveLength(30);
  });

  it('starts on the 1st when it is a Monday', () => {
    expect(monthCalendarDays('2026-06-15')[0]).toEqual({ date: '2026-06-01', inMonth: true });
  });
});

describe('heatLevel', () => {
  it('maps percentages to levels using the thresholds', () => {
    expect(heatLevel(null)).toBe('empty');
    expect(heatLevel(0)).toBe('zero');
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(39)).toBe(1);
    expect(heatLevel(40)).toBe(2);
    expect(heatLevel(69)).toBe(2);
    expect(heatLevel(70)).toBe(3);
    expect(heatLevel(99)).toBe(3);
    expect(heatLevel(100)).toBe(4);
  });
});

describe('heatStats', () => {
  it('averages scored days and finds the longest 100% run', () => {
    const habits = [
      dailyHabit('a', ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']),
      dailyHabit('b', ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05']),
    ];

    // 100, 100, 100, 50, 100
    expect(heatStats(habits, '2026-03-01', '2026-03-05')).toEqual({ avgPct: 90, bestRun: 3 });
  });

  it('skips days without a score in the average and breaks runs on them', () => {
    const habits = [dailyHabit('a', ['2026-03-10', '2026-03-12'])];
    habits[0].createdOn = '2026-03-10';
    habits[0].schedules[0].validFrom = '2026-03-10';

    // 03-08, 03-09: null; 03-10: 100; 03-11: 0; 03-12: 100
    expect(heatStats(habits, '2026-03-08', '2026-03-12')).toEqual({ avgPct: 67, bestRun: 1 });
  });

  it('returns null average and zero run when no day has a score', () => {
    expect(heatStats([], '2026-03-01', '2026-03-05')).toEqual({ avgPct: null, bestRun: 0 });
  });
});
