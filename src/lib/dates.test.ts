import { describe, expect, it } from 'vitest';
import { todayIn } from './dates';

describe('todayIn', () => {
  it('returns the next date in Warsaw just after local midnight (23:30 UTC)', () => {
    expect(todayIn('Europe/Warsaw', new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
  });

  it('returns the same date at midday', () => {
    expect(todayIn('Europe/Warsaw', new Date('2026-11-18T12:00:00Z'))).toBe('2026-11-18');
  });

  it('respects the summer offset (22:30 UTC in July is already the next day in Warsaw)', () => {
    expect(todayIn('Europe/Warsaw', new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
  });

  it('can differ from the UTC date in the other direction', () => {
    expect(todayIn('America/Los_Angeles', new Date('2026-11-18T03:00:00Z'))).toBe('2026-11-17');
  });
});
