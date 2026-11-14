// Jedyne źródło palety kategorii (8 stałych kolorów). Wartość koloru w bazie to `id`.
// dot = kropka/pasek, bg/border = tło i ramka bloku, ink = tekst, mid = tekst pomocniczy.
export const CATEGORY_COLORS = [
  { id: 'blue', label: 'Niebieski', dot: '#4E8FE0', bg: '#F4F8FE', border: '#DCE8F8', ink: '#22578F', mid: '#5B84B1' },
  { id: 'teal', label: 'Morski', dot: '#3AA197', bg: '#F1F8F7', border: '#D4EAE6', ink: '#1C625D', mid: '#5A8E89' },
  { id: 'gray', label: 'Szary', dot: '#9B9A97', bg: '#F7F7F6', border: '#E8E8E6', ink: '#37352F', mid: '#7D7C78' },
  { id: 'rose', label: 'Różowy', dot: '#D86B88', bg: '#FDF4F6', border: '#F3DCE2', ink: '#9A3552', mid: '#B36B80' },
  { id: 'orange', label: 'Pomarańczowy', dot: '#D9733A', bg: '#FBF3EE', border: '#F1DDD0', ink: '#8A4520', mid: '#B0714A' },
  { id: 'violet', label: 'Fioletowy', dot: '#7C6BD6', bg: '#F5F3FD', border: '#E4DFF7', ink: '#4A3D99', mid: '#7C70B8' },
  { id: 'green', label: 'Zielony', dot: '#3E9B63', bg: '#F1F8F3', border: '#D6EBDD', ink: '#23633C', mid: '#5C8E6E' },
  { id: 'amber', label: 'Bursztynowy', dot: '#D4A12A', bg: '#FCF8EC', border: '#F1E6C4', ink: '#7A5A0E', mid: '#9C8240' },
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export type CategoryColorId = CategoryColor['id'];

/** Kolor kategorii po id; nieznana wartość z bazy wraca jako szary. */
export function categoryColor(id: string): CategoryColor {
  return CATEGORY_COLORS.find((c) => c.id === id) ?? CATEGORY_COLORS[2];
}

/** Stary kolor bloku (paleta z etapu 1) → id nowej palety. */
export function legacyColorId(old: string): CategoryColorId {
  if (old === 'red') return 'rose';
  if (old === 'purple') return 'violet';
  if (old === 'blue' || old === 'green' || old === 'orange' || old === 'gray') return old;
  return 'gray';
}
