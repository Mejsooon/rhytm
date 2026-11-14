/**
 * Wynik Server Action. Next.js w produkcji podmienia komunikat błędu rzuconego z akcji na ogólny tekst,
 * więc błędy oczekiwane (walidacja, reguły, nieudany zapis w bazie) wracają do klienta jako wartość.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Błąd oczekiwany: jego (polski) komunikat trafia do użytkownika przez `asResult`. */
export class ExpectedError extends Error {}

/** Uruchamia walidację; rzucony przez nią błąd staje się błędem oczekiwanym z tym samym komunikatem. */
export function expected<T>(check: () => T): T {
  try {
    return check();
  } catch (error) {
    throw new ExpectedError(error instanceof Error ? error.message : 'Nieprawidłowe dane');
  }
}

/**
 * Ciało akcji jako ActionResult: ExpectedError → `{ ok: false, error }`. Pozostałe błędy
 * (brak sesji, błędy programistyczne, redirect Next.js) lecą dalej bez zmian.
 */
export async function asResult<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    if (error instanceof ExpectedError) return { ok: false, error: error.message };
    throw error;
  }
}
