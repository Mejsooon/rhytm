import { describe, expect, it } from 'vitest';
import { categoryCounts, filterOccurrences, revealAfterCreate } from './filters';

const list = [{ categoryId: 'n' }, { categoryId: 'p' }, { categoryId: 'n' }];

describe('filterOccurrences', () => {
  it('„Wszystkie” bez ukrytych kategorii zwraca wszystko', () => {
    expect(filterOccurrences(list, { tab: 'all', hidden: new Set() })).toHaveLength(3);
  });

  it('zakładka kategorii zawęża do tej kategorii', () => {
    expect(filterOccurrences(list, { tab: 'n', hidden: new Set() })).toHaveLength(2);
  });

  it('ukryta kategoria znika z „Wszystkie”', () => {
    expect(filterOccurrences(list, { tab: 'all', hidden: new Set(['n']) })).toHaveLength(1);
  });

  it('zakładka ukrytej kategorii nic nie pokazuje', () => {
    expect(filterOccurrences(list, { tab: 'n', hidden: new Set(['n']) })).toHaveLength(0);
  });
});

describe('categoryCounts', () => {
  it('liczy wystąpienia po kategorii', () => {
    expect(categoryCounts(list)).toEqual({ n: 2, p: 1 });
  });

  it('pusta lista daje pusty obiekt', () => {
    expect(categoryCounts([])).toEqual({});
  });
});

describe('revealAfterCreate', () => {
  it('blok w ukrytej kategorii przy zakładce innej kategorii: wraca na „Wszystkie” i odkrywa kategorię', () => {
    expect(revealAfterCreate({ tab: 'p', hidden: new Set(['n']) }, 'n')).toEqual({
      tab: 'all',
      hidden: new Set(),
      unhide: true,
    });
  });

  it('nic nie zmienia, gdy blok i tak będzie widoczny', () => {
    expect(revealAfterCreate({ tab: 'all', hidden: new Set() }, 'n')).toEqual({
      tab: 'all',
      hidden: new Set(),
      unhide: false,
    });
  });

  it('zostawia zakładkę tej samej kategorii i inne ukryte kategorie', () => {
    expect(revealAfterCreate({ tab: 'n', hidden: new Set(['p']) }, 'n')).toEqual({
      tab: 'n',
      hidden: new Set(['p']),
      unhide: false,
    });
  });

  it('nie zmienia przekazanego zbioru ukrytych', () => {
    const hidden = new Set(['n']);
    revealAfterCreate({ tab: 'all', hidden }, 'n');
    expect(hidden.has('n')).toBe(true);
  });
});
