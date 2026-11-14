"use server";

// Dziennik snu. RLS pilnuje własności, a user_id uzupełnia default w bazie (nigdy z wejścia).
// Wpis jest na dzień pobudki; „dziś” i długość snu liczymy w strefie z profilu.
// Akcje zwracają ActionResult: błędy oczekiwane (walidacja, nieudany zapis) jako { ok: false, error },
// bo Next.js w produkcji ukrywa komunikaty rzuconych błędów. Brak sesji i błędy nieoczekiwane są rzucane.
import { asResult, expected, ExpectedError, type ActionResult } from "@/lib/action-result";
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { todayIn } from "@/lib/dates";
import { assertValidDate } from "@/lib/habits/rules";
import { rowToSleepLog, validateSleepInput, type SleepLog } from "@/lib/sleep/sleep";

// Błąd bazy: szczegóły do logów serwera, użytkownik dostaje polski komunikat.
function dbFailure(message: string, error: { message: string }): ExpectedError {
  console.error(`${message}: ${error.message}`);
  return new ExpectedError(message);
}

// Wpisy snu z zakresu dat (włącznie), od najstarszego.
export async function listSleepLogs(from: string, to: string): Promise<ActionResult<SleepLog[]>> {
  return asResult(async () => {
    expected(() => assertValidDate(from));
    expected(() => assertValidDate(to));
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("sleep_logs")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });
    if (error) throw dbFailure("Nie udało się wczytać snu", error);
    return data.map(rowToSleepLog);
  });
}

// Zapis (nowy albo nadpisanie wpisu z tego dnia). Zwraca zapisany wpis.
export async function saveSleepLog(input: {
  date: string;
  sleptAt: string;
  wokeAt: string;
  feeling: number;
  note: string;
}): Promise<ActionResult<SleepLog>> {
  return asResult(async () => {
    const profile = await ensureProfile();
    const log = expected(() => validateSleepInput(input, profile.timezone, todayIn(profile.timezone, new Date())));
    const supabase = await createServerClient();
    const { error } = await supabase.from("sleep_logs").upsert(
      { date: log.date, slept_at: log.sleptAt, woke_at: log.wokeAt, feeling: log.feeling, note: log.note },
      { onConflict: "user_id,date" },
    );
    if (error) throw dbFailure("Nie udało się zapisać snu", error);
    return log;
  });
}

// Usuwa wpis z danego dnia; brak wpisu nie jest błędem.
export async function deleteSleepLog(date: string): Promise<ActionResult<null>> {
  return asResult(async () => {
    expected(() => assertValidDate(date));
    const supabase = await createServerClient();
    const { error } = await supabase.from("sleep_logs").delete().eq("date", date);
    if (error) throw dbFailure("Nie udało się usunąć snu", error);
    return null;
  });
}
