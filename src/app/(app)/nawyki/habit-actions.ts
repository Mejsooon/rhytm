"use server";

// Nawyki. RLS pilnuje własności, a user_id uzupełnia default w bazie (nigdy z wejścia).
// Dzień „dziś” liczymy w strefie z profilu. Akcje zwracają ActionResult: błędy oczekiwane (walidacja,
// reguły odhaczania, nieudany zapis) jako { ok: false, error } z polskim komunikatem, bo Next.js
// w produkcji ukrywa komunikaty rzuconych błędów. Brak sesji i błędy nieoczekiwane nadal są rzucane.
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { todayIn } from "@/lib/dates";
import { asResult, expected, ExpectedError, type ActionResult } from "@/lib/action-result";
import { loadHabits } from "@/lib/habits/load";
import { assertCheckable, assertValidDate, validateHabitInput } from "@/lib/habits/rules";
import { scheduleOn } from "@/lib/habits/schedule";
import { toDTO, type HabitHistoryDTO } from "@/lib/habits/types";

const UNIQUE_VIOLATION = "23505";

type HabitInput = {
  name: string;
  type: string;
  weekdays: number[];
  timesPerWeek: number | null;
  remindAt?: string | null;
};

// Błąd bazy: szczegóły do logów serwera, użytkownik dostaje polski komunikat.
function dbFailure(message: string, error: { message: string }): ExpectedError {
  console.error(`${message}: ${error.message}`);
  return new ExpectedError(message);
}

// Tworzy nawyk i jego pierwszą wersję harmonogramu (valid_from = dziś). Zwraca nowy nawyk bez odhaczeń.
export async function createHabit(input: HabitInput): Promise<ActionResult<HabitHistoryDTO>> {
  return asResult(async () => {
    const { name, schedule, remindAt } = expected(() => validateHabitInput(input));
    const profile = await ensureProfile();
    const today = todayIn(profile.timezone, new Date());
    const supabase = await createServerClient();

    // Nowy nawyk ląduje na końcu listy.
    const last = await supabase.from("habits").select("position").order("position", { ascending: false }).limit(1);
    if (last.error) throw dbFailure("Nie udało się wczytać nawyków", last.error);
    const position = (last.data[0]?.position ?? -1) + 1;

    const habit = await supabase.from("habits").insert({ name, position, remind_at: remindAt }).select("*").single();
    if (habit.error) throw dbFailure("Nie udało się zapisać nawyku", habit.error);

    const version = await supabase.from("habit_schedules").insert({
      habit_id: habit.data.id,
      valid_from: today,
      schedule_type: schedule.type,
      weekdays: schedule.type === "days" ? schedule.weekdays : null,
      times_per_week: schedule.type === "weekly" ? schedule.timesPerWeek : null,
    });
    if (version.error) {
      // Bez harmonogramu nawyk byłby sierotą, więc usuwamy wiersz nawyku.
      const cleanup = await supabase.from("habits").delete().eq("id", habit.data.id);
      if (cleanup.error) console.error(`Nie udało się usunąć nawyku bez harmonogramu: ${cleanup.error.message}`);
      throw dbFailure("Nie udało się zapisać harmonogramu nawyku", version.error);
    }

    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    return toDTO({
      id: habit.data.id,
      name,
      createdOn: today,
      archivedOn: null,
      schedules: [{ validFrom: today, ...schedule }],
      remindAt,
      checks: new Set(),
    });
  });
}

// Zmiana nazwy aktualizuje wiersz nawyku; zmiana harmonogramu zapisuje wersję od dziś
// (jeśli dzisiejsza wersja już istnieje, jest nadpisywana). Zwraca nawyk z odhaczeniami do dziś.
export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult<HabitHistoryDTO>> {
  return asResult(async () => {
    const { name, schedule, remindAt } = expected(() => validateHabitInput(input));
    const supabase = await createServerClient();
    // Przy wczytaniu jednego nawyku zakres służy tylko do okna odhaczeń, więc data UTC (±1 dzień) wystarcza.
    const approxToday = new Date().toISOString().slice(0, 10);
    const { today, habits } = await loadHabits(approxToday, approxToday, id);
    const habit = habits[0];
    if (!habit) throw new ExpectedError("Nie znaleziono nawyku");
    if (habit.archivedOn !== null) throw new ExpectedError("Nawyk jest zarchiwizowany");

    // Przesunięta godzina zeruje last_reminded_on, żeby przypomnienie mogło przyjść jeszcze dziś.
    if (name !== habit.name || remindAt !== habit.remindAt) {
      const { error } = await supabase
        .from("habits")
        .update(remindAt !== habit.remindAt ? { name, remind_at: remindAt, last_reminded_on: null } : { name })
        .eq("id", id);
      if (error) throw dbFailure("Nie udało się zapisać nawyku", error);
    }

    const current = scheduleOn(habit, today);
    const scheduleChanged =
      current === null ||
      current.type !== schedule.type ||
      current.timesPerWeek !== schedule.timesPerWeek ||
      current.weekdays.join(",") !== schedule.weekdays.join(",");
    if (scheduleChanged) {
      const { error } = await supabase.from("habit_schedules").upsert(
        {
          habit_id: id,
          valid_from: today,
          schedule_type: schedule.type,
          weekdays: schedule.type === "days" ? schedule.weekdays : null,
          times_per_week: schedule.type === "weekly" ? schedule.timesPerWeek : null,
        },
        { onConflict: "habit_id,valid_from" },
      );
      if (error) throw dbFailure("Nie udało się zapisać harmonogramu nawyku", error);
    }

    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    const updated = await loadHabits(today, today, id);
    return toDTO(updated.habits[0]);
  });
}

// Archiwizacja: od dziś nawyk przestaje się liczyć (historia zostaje). Ponowna archiwizacja nic nie zmienia.
export async function archiveHabit(id: string): Promise<ActionResult<null>> {
  return asResult(async () => {
    const profile = await ensureProfile();
    const today = todayIn(profile.timezone, new Date());
    const supabase = await createServerClient();
    const { error } = await supabase.from("habits").update({ archived_at: today }).eq("id", id).is("archived_at", null);
    if (error) throw dbFailure("Nie udało się zarchiwizować nawyku", error);
    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    return null;
  });
}

// Odhacza (done = true) albo cofa odhaczenie (done = false) nawyku w danym dniu.
// Ponowne odhaczenie dnia, który już jest odhaczony, nie jest błędem.
export async function setHabitCheck(habitId: string, date: string, done: boolean): Promise<ActionResult<null>> {
  return asResult(async () => {
    if (typeof done !== "boolean") throw new ExpectedError("Nieprawidłowe dane");
    expected(() => assertValidDate(date));
    const supabase = await createServerClient();
    const { today, habits } = await loadHabits(date, date, habitId);
    const habit = habits[0];
    if (!habit) throw new ExpectedError("Nie znaleziono nawyku");
    expected(() => assertCheckable(habit, date, today));

    if (done) {
      const { error } = await supabase.from("habit_checks").insert({ habit_id: habitId, date });
      if (error && error.code !== UNIQUE_VIOLATION) throw dbFailure("Nie udało się odhaczyć nawyku", error);
    } else {
      const { error } = await supabase.from("habit_checks").delete().eq("habit_id", habitId).eq("date", date);
      if (error) throw dbFailure("Nie udało się cofnąć odhaczenia", error);
    }
    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    return null;
  });
}
