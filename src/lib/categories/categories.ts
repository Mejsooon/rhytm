// Czysta logika kategorii (bez dostępu do bazy): typ, domyślne, walidacja, mapowanie wiersza.
import { CATEGORY_COLORS, type CategoryColorId } from '@/lib/calendar/colors';
import type { Database } from '@/lib/db/types';

export type Category = {
  id: string;
  name: string;
  color: CategoryColorId;
  position: number;
  visible: boolean;
  isSystem: boolean;
};

export const DEFAULT_CATEGORIES: { name: string; color: CategoryColorId }[] = [
  { name: 'Nauka', color: 'blue' },
  { name: 'Uczelnia', color: 'teal' },
  { name: 'Praca', color: 'gray' },
  { name: 'Osobiste', color: 'rose' },
];

export const DUPLICATE_NAME_ERROR = 'Kategoria o tej nazwie już istnieje';

const MAX_NAME_LENGTH = 40;

// Klucz porównania nazw: tak samo jak indeks unikalności w bazie (lower(trim(name))).
const nameKey = (name: string) => name.trim().toLowerCase();

export function validateCategoryInput(
  input: { name: string; color: string },
  existing: Pick<Category, 'id' | 'name'>[],
  editingId?: string,
): { name: string; color: CategoryColorId } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) throw new Error('Nazwa nie może być pusta');
  if (name.length > MAX_NAME_LENGTH) throw new Error('Nazwa może mieć najwyżej 40 znaków');
  const color = CATEGORY_COLORS.find((c) => c.id === input.color);
  if (!color) throw new Error('Nieznany kolor');
  if (existing.some((c) => c.id !== editingId && nameKey(c.name) === nameKey(name))) {
    throw new Error(DUPLICATE_NAME_ERROR);
  }
  return { name, color: color.id };
}

/** Nazwa pierwszej innej kategorii z tym kolorem albo null (okno tylko ostrzega). */
export function colorUsage(categories: Category[], color: CategoryColorId, exceptId?: string): string | null {
  return categories.find((c) => c.color === color && c.id !== exceptId)?.name ?? null;
}

export function rowToCategory(row: Database['public']['Tables']['categories']['Row']): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color as CategoryColorId,
    position: row.position,
    visible: row.visible,
    isSystem: row.is_system,
  };
}
