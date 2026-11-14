import { describe, expect, it } from 'vitest';
import { asResult, expected, ExpectedError } from './action-result';

describe('asResult', () => {
  it('zwraca dane jako { ok: true, data }', async () => {
    await expect(asResult(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it('błąd oczekiwany staje się { ok: false, error }', async () => {
    await expect(
      asResult(async () => {
        throw new ExpectedError('Nazwa nie może być pusta');
      }),
    ).resolves.toEqual({ ok: false, error: 'Nazwa nie może być pusta' });
  });

  it('inne błędy lecą dalej', async () => {
    await expect(
      asResult(async () => {
        throw new Error('auth');
      }),
    ).rejects.toThrow('auth');
  });
});

describe('expected', () => {
  it('przepuszcza wynik', () => {
    expect(expected(() => 'ok')).toBe('ok');
  });

  it('zamienia rzucony błąd na ExpectedError z tym samym komunikatem', () => {
    let caught: unknown;
    try {
      expected(() => {
        throw new Error('Nieprawidłowa data');
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExpectedError);
    expect((caught as Error).message).toBe('Nieprawidłowa data');
  });
});
