import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

// Zakłada wiersz profilu, jeśli go nie ma (idempotentnie), i zwraca aktualny profil bieżącego użytkownika.
// Wywołują ją layout aplikacji i getProfile, więc odczyt nigdy nie trafia na brakujący wiersz.
export async function ensureProfile() {
  // Odczyt sesji najpierw: to on czyni dane dynamicznymi (bez tego build próbowałby je wyrenderować statycznie).
  const { userId } = await auth();
  const supabase = await createServerClient();
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId! }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertError) throw new Error(`ensureProfile: ${upsertError.message}`);
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
  if (error) throw new Error(`ensureProfile: ${error.message}`);
  return data;
}
