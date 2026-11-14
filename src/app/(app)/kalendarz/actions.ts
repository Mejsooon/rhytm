"use server";

// Warstwa danych kalendarza. Akcje niczego nie rewalidują (revalidatePath): pobieraniem danych
// po zapisie zajmuje się klient (ponowny GET /api/occurrences). RLS pilnuje własności,
// a user_id nigdy nie pochodzi z wejścia (uzupełnia go default w bazie).
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { executeMutations } from "@/lib/calendar/execute";
import { rowToException, rowToSeries, seriesToRow } from "@/lib/calendar/mapping";
import { planDelete, planEdit, type BlockChange, type Scope } from "@/lib/calendar/plan-edit";
import type { BlockSeries } from "@/lib/calendar/types";
import { validateBlockFields } from "@/lib/calendar/validation";
import type { Database } from "@/lib/db/types";

export type BlockTask = Database["public"]["Tables"]["block_tasks"]["Row"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Pobiera serię po id (RLS ukrywa cudze) albo rzuca błąd.
async function fetchSeries(blockId: string): Promise<BlockSeries> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("blocks").select("*").eq("id", blockId).maybeSingle();
  if (error) throw new Error(`Nie udało się wczytać bloku: ${error.message}`);
  if (!data) throw new Error("Nie znaleziono bloku");
  return rowToSeries(data);
}

export async function createBlock(input: Omit<BlockSeries, "id" | "timezone">): Promise<string> {
  const { title } = validateBlockFields({
    title: input.title,
    durationMin: input.durationMin,
    startLocal: input.startLocal,
    color: input.color,
    recurrence: input.recurrence,
  });

  // Strefa czasowa pochodzi z profilu, nie z wejścia. Pola przepisujemy jawnie, więc `id` z klienta nie trafi do bazy.
  const profile = await ensureProfile();
  const supabase = await createServerClient();
  const row = seriesToRow({
    title: title!,
    color: input.color,
    note: input.note,
    startLocal: input.startLocal,
    durationMin: input.durationMin,
    recurrence: input.recurrence,
    timezone: profile.timezone,
  });
  const { data, error } = await supabase.from("blocks").insert(row as never).select("id").single();
  if (error) throw new Error(`Nie udało się zapisać bloku: ${error.message}`);
  return data.id;
}

// Wspólna część previewEdit i editBlock: wczytuje serię, wyjątek edytowanego wystąpienia i daty z zadaniami,
// waliduje pola zmiany i planuje mutacje. Datę końca względem efektywnego startu sprawdza planEdit
// (zna nowy start serii także wtedy, gdy zmienia się tylko start).
async function planBlockEdit(blockId: string, occurrenceDate: string, scope: Scope, change: BlockChange) {
  if (!DATE_RE.test(occurrenceDate)) throw new Error("Nieprawidłowa data wystąpienia");
  if (!["this", "following", "all"].includes(scope)) throw new Error("Nieprawidłowy zakres zmiany");
  const series = await fetchSeries(blockId);
  validateBlockFields({
    title: change.title,
    durationMin: change.durationMin,
    color: change.color,
    recurrence: change.recurrence,
  });
  const supabase = await createServerClient();
  const exRes = await supabase
    .from("block_exceptions")
    .select("*")
    .eq("block_id", blockId)
    .eq("occurrence_date", occurrenceDate)
    .maybeSingle();
  if (exRes.error) throw new Error(`Nie udało się wczytać wyjątku: ${exRes.error.message}`);
  const tasksRes = await supabase.from("block_tasks").select("occurrence_date").eq("block_id", blockId);
  if (tasksRes.error) throw new Error(`Nie udało się wczytać zadań: ${tasksRes.error.message}`);
  const taskDates = [...new Set(tasksRes.data.map((t) => t.occurrence_date))];
  return planEdit(
    series,
    occurrenceDate,
    scope,
    { ...change, ...(change.title !== undefined && { title: change.title.trim() }) },
    taskDates,
    exRes.data ? rowToException(exRes.data) : null,
  );
}

export async function previewEdit(
  blockId: string,
  occurrenceDate: string,
  scope: Scope,
  change: BlockChange,
): Promise<{ droppedTaskDates: string[] }> {
  const { droppedTaskDates } = await planBlockEdit(blockId, occurrenceDate, scope, change);
  return { droppedTaskDates };
}

export async function editBlock(blockId: string, occurrenceDate: string, scope: Scope, change: BlockChange): Promise<void> {
  const { mutations } = await planBlockEdit(blockId, occurrenceDate, scope, change);
  await executeMutations(await createServerClient(), mutations);
}

export async function deleteBlock(blockId: string, occurrenceDate: string, scope: Scope): Promise<void> {
  if (!DATE_RE.test(occurrenceDate)) throw new Error("Nieprawidłowa data wystąpienia");
  const series = await fetchSeries(blockId);
  await executeMutations(await createServerClient(), planDelete(series, occurrenceDate, scope));
}

export async function listTasks(blockId: string, occurrenceDate: string): Promise<BlockTask[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("block_tasks")
    .select("*")
    .eq("block_id", blockId)
    .eq("occurrence_date", occurrenceDate)
    .order("position", { ascending: true });
  if (error) throw new Error(`Nie udało się wczytać zadań: ${error.message}`);
  return data;
}

export async function addTask(blockId: string, occurrenceDate: string, title: string): Promise<BlockTask> {
  const { title: trimmed } = validateBlockFields({ title });
  const supabase = await createServerClient();
  // Nowe zadanie ląduje na końcu listy tego wystąpienia.
  const last = await supabase
    .from("block_tasks")
    .select("position")
    .eq("block_id", blockId)
    .eq("occurrence_date", occurrenceDate)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) throw new Error(`Nie udało się zapisać zadania: ${last.error.message}`);
  const { data, error } = await supabase
    .from("block_tasks")
    .insert({ block_id: blockId, occurrence_date: occurrenceDate, title: trimmed!, position: (last.data?.position ?? -1) + 1 })
    .select("*")
    .single();
  if (error) throw new Error(`Nie udało się zapisać zadania: ${error.message}`);
  return data;
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("block_tasks").update({ done }).eq("id", id);
  if (error) throw new Error(`Nie udało się zapisać zadania: ${error.message}`);
}

export async function renameTask(id: string, title: string): Promise<void> {
  const { title: trimmed } = validateBlockFields({ title });
  const supabase = await createServerClient();
  const { error } = await supabase.from("block_tasks").update({ title: trimmed! }).eq("id", id);
  if (error) throw new Error(`Nie udało się zapisać zadania: ${error.message}`);
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("block_tasks").delete().eq("id", id);
  if (error) throw new Error(`Nie udało się usunąć zadania: ${error.message}`);
}
