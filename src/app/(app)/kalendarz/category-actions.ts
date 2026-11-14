"use server";

// Kategorie bloków. RLS pilnuje własności, a user_id uzupełnia default w bazie (nigdy z wejścia).
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { DUPLICATE_NAME_ERROR, rowToCategory, validateCategoryInput, type Category } from "@/lib/categories/categories";

const UNIQUE_VIOLATION = "23505";

export async function listCategories(): Promise<Category[]> {
  // Profil (a z nim domyślne kategorie) istnieje, zanim cokolwiek odczytamy.
  await ensureProfile();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Nie udało się wczytać kategorii: ${error.message}`);
  return data.map(rowToCategory);
}

export async function createCategory(input: { name: string; color: string }): Promise<Category> {
  const supabase = await createServerClient();
  const all = await supabase.from("categories").select("id, name, position");
  if (all.error) throw new Error(`Nie udało się wczytać kategorii: ${all.error.message}`);
  const { name, color } = validateCategoryInput(input, all.data);
  // Nowa kategoria ląduje na końcu listy.
  const position = all.data.reduce((max, c) => Math.max(max, c.position), -1) + 1;
  const { data, error } = await supabase.from("categories").insert({ name, color, position }).select("*").single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error(DUPLICATE_NAME_ERROR);
    throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
  }
  return rowToCategory(data);
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string; visible?: boolean },
): Promise<Category> {
  const supabase = await createServerClient();
  const all = await supabase.from("categories").select("*");
  if (all.error) throw new Error(`Nie udało się wczytać kategorii: ${all.error.message}`);
  const current = all.data.find((c) => c.id === id);
  if (!current) throw new Error("Nie znaleziono kategorii");
  if (patch.visible !== undefined && typeof patch.visible !== "boolean") throw new Error("Nieprawidłowa widoczność");

  // Do bazy trafiają tylko pola obecne w patchu. Nazwę i kolor walidujemy razem (brakujące pole bierzemy z bieżącego wiersza).
  const update: { name?: string; color?: string; visible?: boolean } = {};
  if (patch.name !== undefined || patch.color !== undefined) {
    const valid = validateCategoryInput(
      { name: patch.name ?? current.name, color: patch.color ?? current.color },
      all.data,
      id,
    );
    if (patch.name !== undefined) update.name = valid.name;
    if (patch.color !== undefined) update.color = valid.color;
  }
  if (patch.visible !== undefined) update.visible = patch.visible;
  if (Object.keys(update).length === 0) return rowToCategory(current);

  const { data, error } = await supabase.from("categories").update(update).eq("id", id).select("*").single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error(DUPLICATE_NAME_ERROR);
    throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
  }
  return rowToCategory(data);
}
