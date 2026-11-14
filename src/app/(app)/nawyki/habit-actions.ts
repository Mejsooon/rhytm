"use server";

// Nawyki. RLS pilnuje własności, a user_id uzupełnia default w bazie (nigdy z wejścia).
// Dzień „dziś” liczymy w strefie z profilu. Akcje zwracają HabitHistoryDTO (checks jako string[]) albo nic.
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { todayIn } from "@/lib/dates";
import { loadHabits } from "@/lib/habits/load";
import { assertCheckable, validateHabitInput } from "@/lib/habits/rules";
import { scheduleOn } from "@/lib/habits/schedule";
import { toDTO, type HabitHistoryDTO } from "@/lib/habits/types";

const UNIQUE_VIOLATION = "23505";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type HabitInput = { name: string; type: string; weekdays: number[]; timesPerWeek: number | null };

// Tworzy nawyk i jego pierwszą wersję harmonogramu (valid_from = dziś). Zwraca nowy nawyk bez odhaczeń.
export async function createHabit(input: HabitInput): Promise<HabitHistoryDTO> {
  const { name, schedule } = validateHabitInput(input);
  const profile = await ensureProfile();
  const today = todayIn(profile.timezone, new Date());
  const supabase = await createServerClient();

  // Nowy nawyk ląduje na końcu listy.
  const last = await supabase.from("habits").select("position").order("position", { ascending: false }).limit(1);
  if (last.error) throw new Error(`Nie udało się wczytać nawyków: ${last.error.message}`);
  const position = (last.data[0]?.position ?? -1) + 1;

  const habit = await supabase.from("habits").insert({ name, position }).select("*").single();
  if (habit.error) throw new Error(`Nie udało się zapisać nawyku: ${habit.error.message}`);

  const version = await supabase.from("habit_schedules").insert({
    habit_id: habit.data.id,
    valid_from: today,
    schedule_type: schedule.type,
    weekdays: schedule.type === "days" ? schedule.weekdays : null,
    times_per_week: schedule.type === "weekly" ? schedule.timesPerWeek : null,
  });
  if (version.error) {
    // Bez harmonogramu nawyk byłby sierotą, więc usuwamy wiersz nawyku.
    await supabase.from("habits").delete().eq("id", habit.data.id);
    throw new Error(`Nie udało się zapisać harmonogramu nawyku: ${version.error.message}`);
  }

  return toDTO({
    id: habit.data.id,
    name,
    createdOn: today,
    archivedOn: null,
    schedules: [{ validFrom: today, ...schedule }],
    checks: new Set(),
  });
}

// Zmiana nazwy aktualizuje wiersz nawyku; zmiana harmonogramu zapisuje wersję od dziś
// (jeśli dzisiejsza wersja już istnieje, jest nadpisywana). Zwraca nawyk z odhaczeniami do dziś.
export async function updateHabit(id: string, input: HabitInput): Promise<HabitHistoryDTO> {
  const { name, schedule } = validateHabitInput(input);
  const supabase = await createServerClient();
  // Przy wczytaniu jednego nawyku zakres służy tylko do okna odhaczeń, więc data UTC (±1 dzień) wystarcza.
  const approxToday = new Date().toISOString().slice(0, 10);
  const { today, habits } = await loadHabits(approxToday, approxToday, id);
  const habit = habits[0];
  if (!habit) throw new Error("Nie znaleziono nawyku");
  if (habit.archivedOn !== null) throw new Error("Nawyk jest zarchiwizowany");

  if (name !== habit.name) {
    const { error } = await supabase.from("habits").update({ name }).eq("id", id);
    if (error) throw new Error(`Nie udało się zapisać nawyku: ${error.message}`);
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
    if (error) throw new Error(`Nie udało się zapisać harmonogramu nawyku: ${error.message}`);
  }

  const updated = await loadHabits(today, today, id);
  return toDTO(updated.habits[0]);
}

// Archiwizacja: od dziś nawyk przestaje się liczyć (historia zostaje). Ponowna archiwizacja nic nie zmienia.
export async function archiveHabit(id: string): Promise<void> {
  const profile = await ensureProfile();
  const today = todayIn(profile.timezone, new Date());
  const supabase = await createServerClient();
  const { error } = await supabase.from("habits").update({ archived_at: today }).eq("id", id).is("archived_at", null);
  if (error) throw new Error(`Nie udało się zarchiwizować nawyku: ${error.message}`);
}

// Odhacza (done = true) albo cofa odhaczenie (done = false) nawyku w danym dniu.
// Ponowne odhaczenie dnia, który już jest odhaczony, nie jest błędem.
export async function setHabitCheck(habitId: string, date: string, done: boolean): Promise<void> {
  if (!DATE_PATTERN.test(date)) throw new Error("Nieprawidłowa data");
  const supabase = await createServerClient();
  const { today, habits } = await loadHabits(date, date, habitId);
  const habit = habits[0];
  if (!habit) throw new Error("Nie znaleziono nawyku");
  assertCheckable(habit, date, today);

  if (done) {
    const { error } = await supabase.from("habit_checks").insert({ habit_id: habitId, date });
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`Nie udało się odhaczyć nawyku: ${error.message}`);
  } else {
    const { error } = await supabase.from("habit_checks").delete().eq("habit_id", habitId).eq("date", date);
    if (error) throw new Error(`Nie udało się cofnąć odhaczenia: ${error.message}`);
  }
}
