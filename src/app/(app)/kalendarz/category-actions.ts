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

  // Pola spoza patcha zostają bez zmian; walidujemy zawsze pełną parę nazwa + kolor.
  const { name, color } = validateCategoryInput(
    { name: patch.name ?? current.name, color: patch.color ?? current.color },
    all.data,
    id,
  );
  const { data, error } = await supabase
    .from("categories")
    .update({ name, color, ...(patch.visible !== undefined && { visible: patch.visible }) })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error(DUPLICATE_NAME_ERROR);
    throw new Error(`Nie udało się zapisać kategorii: ${error.message}`);
  }
  return rowToCategory(data);
}
