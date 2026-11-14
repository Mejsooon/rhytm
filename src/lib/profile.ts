import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/categories/categories";

const UNIQUE_VIOLATION = "23505";

// Wstawia domyślne kategorie tylko wtedy, gdy użytkownik nie ma żadnej (także tych z migracji kolorów).
// Upsert z onConflict nie zadziała (unikalność jest na wyrażeniu lower(trim(name))), więc zwykły insert:
// błąd unikalności z równoległego wejścia (druga karta) oznacza, że kategorie już ktoś dodał.
export async function ensureCategories(): Promise<void> {
  const supabase = await createServerClient();
  const { count, error: countError } = await supabase.from("categories").select("id", { count: "exact", head: true });
  if (countError) throw new Error(`ensureCategories: ${countError.message}`);
  if ((count ?? 0) > 0) return;
  const { error } = await supabase
    .from("categories")
    .insert(DEFAULT_CATEGORIES.map((c, position) => ({ name: c.name, color: c.color, position })));
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`ensureCategories: ${error.message}`);
}

// Zakłada wiersz profilu, jeśli go nie ma (idempotentnie), i zwraca aktualny profil bieżącego użytkownika.
// Wywołują ją layout aplikacji i getProfile, więc odczyt nigdy nie trafia na brakujący wiersz.
export const ensureProfile = cache(async () => {
  // Odczyt sesji najpierw: to on czyni dane dynamicznymi (bez tego build próbowałby je wyrenderować statycznie).
  const { userId } = await auth();
  const supabase = await createServerClient();
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId! }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertError) throw new Error(`ensureProfile: ${upsertError.message}`);
  await ensureCategories();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
  if (error) throw new Error(`ensureProfile: ${error.message}`);
  return data;
});
