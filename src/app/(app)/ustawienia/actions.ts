"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import { validateProfile, type ProfileInput } from "@/lib/profile-validation";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof ProfileInput | "form", string>> };

// Profil bieżącego użytkownika (z założeniem wiersza, jeśli go jeszcze nie ma). Kalendarz bierze z niego strefę czasową.
export async function getProfile() {
  return ensureProfile();
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
    sleep_goal_min: String(formData.get("sleep_goal_min") ?? ""),
  });
  if (!result.ok) return result;

  const supabase = await createServerClient();
  // Wiersz zakłada się przed zapisem; .select() pozwala sprawdzić, że aktualizacja faktycznie coś zmieniła.
  await ensureProfile();
  const { data, error } = await supabase.from("profiles").update(result.value).eq("user_id", userId).select();
  if (error || !data || data.length === 0) return { ok: false, errors: { form: "Nie udało się zapisać zmian. Spróbuj ponownie." } };
  return { ok: true };
}
