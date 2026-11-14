import { describe, expect, it } from 'vitest';
import { colorUsage, DEFAULT_CATEGORIES, validateCategoryInput, type Category } from './categories';
import type { CategoryColorId } from '@/lib/calendar/colors';

const cat = (id: string, name: string, color: CategoryColorId): Category => ({
  id,
  name,
  color,
  position: 0,
  visible: true,
  isSystem: false,
});

describe('validateCategoryInput', () => {
  const existing = [{ id: 'a', name: 'Nauka' }];

  it('przycina nazwę i przyjmuje poprawny kolor', () => {
    expect(validateCategoryInput({ name: '  Projekty ', color: 'violet' }, existing)).toEqual({ name: 'Projekty', color: 'violet' });
  });

  it('odrzuca duplikat bez względu na wielkość liter i spacje', () => {
    expect(() => validateCategoryInput({ name: ' nauka ', color: 'blue' }, existing)).toThrow('Kategoria o tej nazwie już istnieje');
  });

  it('pozwala zmienić wielkość liter własnej nazwy', () => {
    expect(validateCategoryInput({ name: 'NAUKA', color: 'blue' }, existing, 'a').name).toBe('NAUKA');
  });

  it('odrzuca pustą nazwę', () => {
    expect(() => validateCategoryInput({ name: '   ', color: 'blue' }, [])).toThrow('Nazwa nie może być pusta');
  });

  it('odrzuca zbyt długą nazwę, ale przyjmuje 40 znaków', () => {
    expect(() => validateCategoryInput({ name: 'x'.repeat(41), color: 'blue' }, [])).toThrow('Nazwa może mieć najwyżej 40 znaków');
    expect(validateCategoryInput({ name: 'x'.repeat(40), color: 'blue' }, []).name).toHaveLength(40);
  });

  it('odrzuca nieznany kolor', () => {
    expect(() => validateCategoryInput({ name: 'A', color: 'red' }, [])).toThrow('Nieznany kolor');
  });
});

describe('colorUsage', () => {
  it('zwraca nazwę innej kategorii z tym kolorem', () => {
    expect(colorUsage([cat('a', 'Nauka', 'blue')], 'blue')).toBe('Nauka');
  });

  it('pomija wskazaną kategorię i inne kolory', () => {
    expect(colorUsage([cat('a', 'Nauka', 'blue')], 'blue', 'a')).toBeNull();
    expect(colorUsage([cat('a', 'Nauka', 'blue')], 'rose')).toBeNull();
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('ma cztery domyślne kategorie w kolejności', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual(['Nauka', 'Uczelnia', 'Praca', 'Osobiste']);
    expect(DEFAULT_CATEGORIES.map((c) => c.color)).toEqual(['blue', 'teal', 'gray', 'rose']);
  });
});
