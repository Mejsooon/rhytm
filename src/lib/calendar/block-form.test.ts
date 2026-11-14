import { describe, expect, it } from 'vitest';
import {
  blockFormFromOccurrence,
  emptyBlockForm,
  formDurationMin,
  formToChange,
  formToNewBlock,
  formToRecurrence,
  nextFullHour,
  toLocalString,
} from './block-form';

describe('toLocalString / nextFullHour', () => {
  it('formatuje chwilę w strefie profilu', () => {
    expect(toLocalString(new Date('2026-07-01T10:00:00Z'), 'Europe/Warsaw')).toBe('2026-07-01T12:00');
    expect(toLocalString(new Date('2026-11-18T10:00:00Z'), 'Europe/Warsaw')).toBe('2026-11-18T11:00');
  });

  it('zaokrągla w górę do pełnej godziny, także przez północ', () => {
    expect(nextFullHour(new Date('2026-11-18T10:20:00Z'), 'Europe/Warsaw')).toBe('2026-11-18T12:00');
    expect(nextFullHour(new Date('2026-11-18T10:00:00Z'), 'Europe/Warsaw')).toBe('2026-11-18T11:00');
    expect(nextFullHour(new Date('2026-11-18T22:30:00Z'), 'Europe/Warsaw')).toBe('2026-11-19T00:00');
  });
});

describe('formToRecurrence', () => {
  it('mapuje tryby na Recurrence', () => {
    expect(formToRecurrence({ repeat: 'none', weekdays: [], until: '' })).toBeNull();
    expect(formToRecurrence({ repeat: 'daily', weekdays: [], until: '' })).toEqual({ freq: 'daily' });
    expect(formToRecurrence({ repeat: 'weekdays', weekdays: [], until: '2026-12-31' })).toEqual({
      freq: 'weekdays',
      until: '2026-12-31',
    });
    expect(formToRecurrence({ repeat: 'weekly', weekdays: [], until: '' })).toEqual({ freq: 'weekly' });
    expect(formToRecurrence({ repeat: 'custom', weekdays: [5, 1, 3], until: '' })).toEqual({
      freq: 'custom',
      byWeekday: [1, 3, 5],
    });
  });

  it('wybrane dni bez żadnego dnia to błąd', () => {
    expect(() => formToRecurrence({ repeat: 'custom', weekdays: [], until: '' })).toThrow(/dzień/);
  });
});

describe('formularz bloku', () => {
  const base = { ...emptyBlockForm('2026-11-19T08:00', 120), title: '  Nauka matma ', note: ' ' };

  it('emptyBlockForm liczy koniec z czasu trwania i przycina do północy', () => {
    expect(base).toMatchObject({ date: '2026-11-19', startTime: '08:00', endTime: '10:00', repeat: 'none' });
    expect(emptyBlockForm('2026-11-19T23:00', 120).endTime).toBe('23:59');
  });

  it('formDurationMin wymaga końca po początku', () => {
    expect(formDurationMin({ startTime: '08:00', endTime: '10:30' })).toBe(150);
    expect(() => formDurationMin({ startTime: '10:00', endTime: '10:00' })).toThrow();
    expect(() => formDurationMin({ startTime: '10:00', endTime: '09:00' })).toThrow();
  });

  it('formToNewBlock buduje wejście createBlock', () => {
    expect(formToNewBlock({ ...base, repeat: 'weekdays', until: '2027-01-31' })).toEqual({
      title: 'Nauka matma',
      color: 'blue',
      note: null,
      startLocal: '2026-11-19T08:00',
      durationMin: 120,
      recurrence: { freq: 'weekdays', until: '2027-01-31' },
    });
  });

  it('pusta nazwa to błąd', () => {
    expect(() => formToNewBlock({ ...base, title: '  ' })).toThrow('Podaj nazwę bloku');
    expect(() => formToChange({ ...base, title: '' })).toThrow('Podaj nazwę bloku');
  });

  it('formToChange nie zawiera powtarzania, a notatka może być wyczyszczona', () => {
    expect(formToChange({ ...base, note: 'x' })).toEqual({
      title: 'Nauka matma',
      color: 'blue',
      note: 'x',
      startLocal: '2026-11-19T08:00',
      durationMin: 120,
    });
  });

  it('blockFormFromOccurrence czyta godziny w strefie profilu', () => {
    const form = blockFormFromOccurrence(
      {
        blockId: 'b1',
        occurrenceDate: '2026-11-19',
        start: new Date('2026-11-19T07:00:00Z'),
        end: new Date('2026-11-19T09:00:00Z'),
        title: 'Nauka',
        color: 'red',
        note: 'n',
        recurring: true,
      },
      'Europe/Warsaw',
    );
    expect(form).toMatchObject({ date: '2026-11-19', startTime: '08:00', endTime: '10:00', color: 'red', note: 'n' });
  });
});
