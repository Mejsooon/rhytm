/** Filtr kalendarza: zakładka ('all' albo id kategorii) i zbiór id ukrytych kategorii. */
export type CalendarFilter = { tab: 'all' | string; hidden: ReadonlySet<string> };

/**
 * Wystąpienia widoczne przy danym filtrze. „Wszystkie” pomija ukryte kategorie;
 * wybrana zakładka kategorii pokazuje jej bloki nawet wtedy, gdy kategoria jest ukryta.
 */
export function filterOccurrences<T extends { categoryId: string }>(list: T[], filter: CalendarFilter): T[] {
  if (filter.tab !== 'all') return list.filter((o) => o.categoryId === filter.tab);
  return list.filter((o) => !filter.hidden.has(o.categoryId));
}

/** Liczba wystąpień po id kategorii (liczniki w liście kategorii). */
export function categoryCounts(list: { categoryId: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of list) counts[o.categoryId] = (counts[o.categoryId] ?? 0) + 1;
  return counts;
}

/**
 * Filtr po utworzeniu bloku w kategorii `categoryId`, tak żeby nowy blok był widoczny:
 * zakładka innej kategorii wraca na „Wszystkie”, a ukryta kategoria się odkrywa (`unhide: true`).
 */
export function revealAfterCreate(
  state: CalendarFilter,
  categoryId: string,
): { tab: 'all' | string; hidden: Set<string>; unhide: boolean } {
  const hidden = new Set(state.hidden);
  const unhide = hidden.delete(categoryId);
  const tab = state.tab === 'all' || state.tab === categoryId ? state.tab : 'all';
  return { tab, hidden, unhide };
}
