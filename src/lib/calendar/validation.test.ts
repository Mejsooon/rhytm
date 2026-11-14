import { describe, expect, it } from 'vitest';
import { validateBlockFields } from './validation';

describe('validateBlockFields', () => {
  it('przepuszcza poprawne dane i przycina tytuł', () => {
    expect(validateBlockFields({ title: '  Nauka ', durationMin: 60, startLocal: '2026-11-16T09:00' })).toEqual({ title: 'Nauka' });
  });
  it('odrzuca pusty tytuł', () => {
    expect(() => validateBlockFields({ title: '   ' })).toThrow('Tytuł nie może być pusty');
  });
  it('odrzuca czas trwania poza 5–1440 i niecałkowity', () => {
    expect(() => validateBlockFields({ durationMin: 4 })).toThrow('Czas trwania musi wynosić od 5 do 1440 minut');
    expect(() => validateBlockFields({ durationMin: 1441 })).toThrow('Czas trwania musi wynosić od 5 do 1440 minut');
    expect(() => validateBlockFields({ durationMin: 30.5 })).toThrow('Czas trwania musi wynosić od 5 do 1440 minut');
    expect(() => validateBlockFields({ durationMin: 5 })).not.toThrow();
    expect(() => validateBlockFields({ durationMin: 1440 })).not.toThrow();
  });
  it('odrzuca until wcześniejsze niż data startu, dopuszcza równe', () => {
    const startLocal = '2026-11-16T09:00';
    expect(() => validateBlockFields({ startLocal, recurrence: { freq: 'daily', until: '2026-11-15' } })).toThrow(
      'Data końca nie może być wcześniejsza niż data początku',
    );
    expect(() => validateBlockFields({ startLocal, recurrence: { freq: 'daily', until: '2026-11-16' } })).not.toThrow();
    expect(() => validateBlockFields({ startLocal, recurrence: { freq: 'weekly' } })).not.toThrow();
  });

  it('odrzuca nieznaną kategorię i zły format startu', () => {
    expect(() => validateBlockFields({ categoryId: 'blue' })).toThrow('Nieznana kategoria');
    expect(() => validateBlockFields({ categoryId: '11111111-1111-4111-8111-111111111111' })).not.toThrow();
    expect(() => validateBlockFields({ categoryId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' })).not.toThrow();
    expect(() => validateBlockFields({ startLocal: '2026-11-16 09:00' })).toThrow('Nieprawidłowa data początku');
  });
  it('sprawdza kształt powtarzania', () => {
    const bad = (recurrence: unknown) => () => validateBlockFields({ recurrence: recurrence as never });
    expect(bad({ freq: 'hourly' })).toThrow('Nieprawidłowe powtarzanie');
    expect(bad({ freq: 'custom', byWeekday: [] })).toThrow('Nieprawidłowe powtarzanie');
    expect(bad({ freq: 'custom', byWeekday: [0, 8] })).toThrow('Nieprawidłowe powtarzanie');
    expect(bad({ freq: 'daily', until: '31.12.2026' })).toThrow('Nieprawidłowe powtarzanie');
    expect(bad({ freq: 'custom', byWeekday: [1, 7], until: '2026-12-31' })).not.toThrow();
    expect(bad(null)).not.toThrow();
  });
});
