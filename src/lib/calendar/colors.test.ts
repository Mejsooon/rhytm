import { describe, expect, it } from 'vitest';
import { CATEGORY_COLORS, categoryColor, legacyColorId } from './colors';

describe('paleta kategorii', () => {
  it('ma 8 kolorów w ustalonej kolejności z etykietami', () => {
    expect(CATEGORY_COLORS.map((c) => c.id)).toEqual(['blue', 'teal', 'gray', 'rose', 'orange', 'violet', 'green', 'amber']);
    expect(CATEGORY_COLORS.map((c) => c.label)).toEqual([
      'Niebieski', 'Morski', 'Szary', 'Różowy', 'Pomarańczowy', 'Fioletowy', 'Zielony', 'Bursztynowy',
    ]);
  });

  it('zwraca wartości z projektu', () => {
    expect(categoryColor('violet')).toMatchObject({ dot: '#7C6BD6', bg: '#F5F3FD', border: '#E4DFF7', ink: '#4A3D99', mid: '#7C70B8' });
  });

  it('nieznane id wraca jako szary', () => {
    expect(categoryColor('nie-ma').id).toBe('gray');
  });
});

describe('legacyColorId', () => {
  it('mapuje stare kolory', () => {
    expect(legacyColorId('red')).toBe('rose');
    expect(legacyColorId('purple')).toBe('violet');
    expect(legacyColorId('green')).toBe('green');
    expect(legacyColorId('blue')).toBe('blue');
    expect(legacyColorId('orange')).toBe('orange');
    expect(legacyColorId('gray')).toBe('gray');
    expect(legacyColorId('cokolwiek')).toBe('gray');
  });
});
