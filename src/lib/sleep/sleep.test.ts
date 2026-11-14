import { describe, expect, it } from 'vitest';
import { formatMinutes, sleepBars, sleepMinutes, sleepStats, validateSleepInput } from './sleep';
import type { SleepLog } from './sleep';

const TZ = 'Europe/Warsaw';

function log(date: string, sleptAt: string, wokeAt: string, feeling = 3): SleepLog {
  return { date, sleptAt, wokeAt, feeling, note: null };
}

const validInput = { date: '2026-11-18', sleptAt: '23:00', wokeAt: '07:00', feeling: 3, note: '' };

describe('sleepMinutes', () => {
  it('counts a night across midnight', () => {
    expect(sleepMinutes('2026-11-18', '23:40', '07:10', TZ)).toBe(450);
  });

  it('counts sleep that started after midnight', () => {
    expect(sleepMinutes('2026-11-18', '00:30', '07:00', TZ)).toBe(390);
  });

  it('counts the extra hour on the night clocks go back', () => {
    expect(sleepMinutes('2026-10-25', '23:00', '07:00', TZ)).toBe(540);
  });

  it('counts the missing hour on the night clocks go forward', () => {
    expect(sleepMinutes('2026-03-29', '23:00', '07:00', TZ)).toBe(420);
  });

  it('treats equal times as a full day back', () => {
    expect(sleepMinutes('2026-11-18', '07:00', '07:00', TZ)).toBe(1440);
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(450)).toBe('7 h 30');
    expect(formatMinutes(480)).toBe('8 h');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(425)).toBe('7 h 05');
  });
});

describe('validateSleepInput', () => {
  it('returns a log with a trimmed note, or null for an empty one', () => {
    expect(validateSleepInput({ ...validInput, note: '  dobrze  ' }, TZ, '2026-11-18')).toEqual({
      date: '2026-11-18',
      sleptAt: '23:00',
      wokeAt: '07:00',
      feeling: 3,
      note: 'dobrze',
    });
    expect(validateSleepInput({ ...validInput, note: '   ' }, TZ, '2026-11-18').note).toBeNull();
  });

  it('rejects malformed times and dates', () => {
    expect(() => validateSleepInput({ ...validInput, sleptAt: '24:00' }, TZ, '2026-11-18')).toThrow('Nieprawidłowa godzina');
    expect(() => validateSleepInput({ ...validInput, wokeAt: '7:00' }, TZ, '2026-11-18')).toThrow('Nieprawidłowa godzina');
    expect(() => validateSleepInput({ ...validInput, date: '18-11-2026' }, TZ, '2026-11-18')).toThrow('Nieprawidłowa data');
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-10']) {
      expect(() => validateSleepInput({ ...validInput, date }, TZ, '2026-11-18')).toThrow('Nieprawidłowa data');
    }
  });

  it('rejects sleep shorter than 30 minutes or longer than 16 hours', () => {
    const tooShort = { ...validInput, sleptAt: '06:50', wokeAt: '07:00' };
    expect(() => validateSleepInput(tooShort, TZ, '2026-11-18')).toThrow('Sen musi trwać od 30 minut do 16 godzin');
    const tooLong = { ...validInput, sleptAt: '14:00', wokeAt: '07:00' };
    expect(() => validateSleepInput(tooLong, TZ, '2026-11-18')).toThrow('Sen musi trwać od 30 minut do 16 godzin');
    expect(validateSleepInput({ ...validInput, sleptAt: '06:30' }, TZ, '2026-11-18').sleptAt).toBe('06:30');
  });

  it('rejects feeling outside 1-5', () => {
    expect(() => validateSleepInput({ ...validInput, feeling: 0 }, TZ, '2026-11-18')).toThrow('Samopoczucie musi być od 1 do 5');
    expect(() => validateSleepInput({ ...validInput, feeling: 6 }, TZ, '2026-11-18')).toThrow('Samopoczucie musi być od 1 do 5');
    expect(() => validateSleepInput({ ...validInput, feeling: 2.5 }, TZ, '2026-11-18')).toThrow('Samopoczucie musi być od 1 do 5');
  });

  it('rejects a note over 500 characters', () => {
    expect(() => validateSleepInput({ ...validInput, note: 'a'.repeat(501) }, TZ, '2026-11-18')).toThrow(
      'Notatka może mieć najwyżej 500 znaków',
    );
    expect(validateSleepInput({ ...validInput, note: '😀'.repeat(500) }, TZ, '2026-11-18').note).toHaveLength(1000);
    expect(validateSleepInput({ ...validInput, note: 'a'.repeat(500) }, TZ, '2026-11-18').note).toHaveLength(500);
  });

  it('rejects a future date', () => {
    expect(() => validateSleepInput({ ...validInput, date: '2026-11-19' }, TZ, '2026-11-18')).toThrow(
      'Nie można zapisać snu z przyszłości',
    );
  });
});

describe('sleepBars', () => {
  it('returns the right number of bars per range', () => {
    expect(sleepBars([], 'month', '2026-11-18', TZ, 480)).toHaveLength(30);
    expect(sleepBars([], 'quarter', '2026-11-18', TZ, 480)).toHaveLength(13);
    expect(sleepBars([], 'half', '2026-11-18', TZ, 480)).toHaveLength(26);
    expect(sleepBars([], 'year', '2026-11-18', TZ, 480)).toHaveLength(12);
  });

  it('month: one bar per night, oldest first, labels every 5th day back plus the first', () => {
    const bars = sleepBars([log('2026-11-18', '23:40', '07:10')], 'month', '2026-11-18', TZ, 450);

    expect(bars[0].key).toBe('2026-10-20');
    expect(bars[29].key).toBe('2026-11-18');
    expect(bars.filter((bar) => bar.label !== '').map((bar) => bar.label)).toEqual(['20', '24', '29', '3', '8', '13', '18']);
    expect(bars[29]).toMatchObject({ minutes: 450, metGoal: true, latest: true, title: '18 lis · 7 h 30' });
    expect(bars[28]).toMatchObject({ minutes: null, metGoal: false, latest: false, title: '17 lis · brak wpisu' });
    expect(bars.filter((bar) => bar.latest)).toHaveLength(1);
  });

  it('month: goal is not met below the goal', () => {
    const bars = sleepBars([log('2026-11-18', '23:40', '07:10')], 'month', '2026-11-18', TZ, 451);
    expect(bars[29].metGoal).toBe(false);
  });

  it('quarter: averages the logs of each ISO week and labels every column with the Monday', () => {
    // Week Mon 2026-11-16 .. Sun 2026-11-22: 420 and 480 minutes -> 450.
    const logs = [log('2026-11-17', '00:00', '07:00'), log('2026-11-18', '23:00', '07:00')];
    const bars = sleepBars(logs, 'quarter', '2026-11-18', TZ, 450);

    expect(bars[12]).toMatchObject({
      key: '2026-11-16',
      label: '16.11',
      minutes: 450,
      metGoal: true,
      latest: true,
      title: 'tydzień od 16 lis · średnio 7 h 30',
    });
    expect(bars[11]).toMatchObject({ key: '2026-11-09', minutes: null, title: 'tydzień od 9 lis · brak wpisu' });
    expect(bars.every((bar) => bar.label !== '')).toBe(true);
  });

  it('half: labels every second column, newest included', () => {
    const bars = sleepBars([], 'half', '2026-11-18', TZ, 480);
    const labelled = bars.map((bar, index) => (bar.label !== '' ? index : -1)).filter((index) => index >= 0);

    expect(labelled).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
  });

  it('year: monthly mean over 12 months ending with the current one', () => {
    // 23:00 -> 06:55 is 475 minutes, 23:00 -> 07:00 is 480; mean 477.5 rounds to 478 = 7 h 58.
    const logs = [log('2026-11-02', '23:00', '06:55'), log('2026-11-03', '23:00', '07:00'), log('2026-01-10', '00:00', '07:00')];
    const bars = sleepBars(logs, 'year', '2026-11-18', TZ, 480);

    expect(bars[0]).toMatchObject({ key: '2025-12', label: 'gru', minutes: null });
    expect(bars[11]).toMatchObject({ key: '2026-11', label: 'lis', minutes: 478, latest: true, title: 'lis 2026 · średnio 7 h 58' });
    expect(bars[1]).toMatchObject({ key: '2026-01', label: 'sty', minutes: 420 });
    expect(bars[2]).toMatchObject({ title: 'lut 2026 · brak wpisu' });
  });
});

describe('sleepStats', () => {
  it('returns nulls when there are no logs in range', () => {
    expect(sleepStats([], '2026-11-01', '2026-11-30', TZ)).toEqual({ avgMinutes: null, avgBedtime: null, avgFeeling: null });
  });

  it('averages bedtimes around midnight', () => {
    expect(sleepStats([log('2026-11-10', '23:50', '07:00'), log('2026-11-11', '00:10', '07:00')], '2026-11-01', '2026-11-30', TZ).avgBedtime).toBe('00:00');
  });

  it('averages minutes and feeling over logs within the range only', () => {
    const logs = [
      log('2026-11-10', '23:00', '07:00', 4), // 480
      log('2026-11-11', '23:00', '06:00', 3), // 420
      log('2026-11-12', '23:00', '06:00', 3), // 420
      log('2026-10-31', '01:00', '12:00', 1), // out of range
    ];
    const stats = sleepStats(logs, '2026-11-01', '2026-11-30', TZ);

    expect(stats.avgMinutes).toBe(440);
    expect(stats.avgBedtime).toBe('23:00');
    expect(stats.avgFeeling).toBe(3.3);
  });
});
