"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { validateProfile, type ProfileInput } from "@/lib/profile-validation";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof ProfileInput | "form", string>> };

// Profil bieżącego użytkownika (RLS zwraca tylko jego wiersz). Kalendarz bierze z niego strefę czasową.
export async function getProfile() {
  // Odczyt sesji najpierw: to ona czyni dane dynamicznymi (bez tego build próbowałby je wyrenderować statycznie).
  const { userId } = await auth();
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, errors: { form: "Zaloguj się ponownie." } };

  const result = validateProfile({
    weight_kg: String(formData.get("weight_kg") ?? ""),
    height_cm: String(formData.get("height_cm") ?? ""),
    birth_date: String(formData.get("birth_date") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  });
  if (!result.ok) return result;

  const supabase = await createServerClient();
  const { error } = await supabase.from("profiles").update(result.value).eq("user_id", userId);
  if (error) return { ok: false, errors: { form: "Nie udało się zapisać zmian. Spróbuj ponownie." } };
  return { ok: true };
}
