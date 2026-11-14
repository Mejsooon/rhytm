// Jedyne źródło palety kategorii bloków (6 stałych kolorów). Wartość `color` bloku w bazie to `id`.
export const CATEGORY_COLORS = [
  { id: 'blue', label: 'Niebieski', bg: '#ECF6FF', border: '#CFE7FF', bar: '#4693F1', ink: '#1D4D87' },
  { id: 'green', label: 'Zielony', bg: '#ECF9EE', border: '#CEEFD3', bar: '#33AC5A', ink: '#0B5D2A' },
  { id: 'orange', label: 'Pomarańczowy', bg: '#FFF1EA', border: '#FFDBCA', bar: '#DF6C32', ink: '#7C350E' },
  { id: 'red', label: 'Czerwony', bg: '#FFF0F3', border: '#FFD9E1', bar: '#E0567A', ink: '#7E2440' },
  { id: 'purple', label: 'Fioletowy', bg: '#F4F3FF', border: '#E3E0FF', bar: '#927EEC', ink: '#4D4084' },
  { id: 'gray', label: 'Szary', bg: '#F2F1EE', border: '#E2E0DC', bar: '#545250', ink: '#191816' },
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Kolor kategorii po id; nieznana wartość z bazy wraca jako szary. */
export function categoryColor(id: string): CategoryColor {
  return CATEGORY_COLORS.find((c) => c.id === id) ?? CATEGORY_COLORS[5];
}
