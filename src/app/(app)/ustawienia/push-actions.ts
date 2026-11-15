"use server";

// Subskrypcje push bieżącego urządzenia. Zapis idzie przez funkcję bazy save_push_subscription
// (usuwa stary wiersz z tym endpointem, także cudzy, i wstawia go dla bieżącego użytkownika),
// a usuwanie dotyczy tylko własnego wiersza (RLS).
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { asResult, expected, ExpectedError, type ActionResult } from "@/lib/action-result";
import { validatePushSubscription } from "@/lib/push/subscription";

export async function savePushSubscription(input: unknown): Promise<ActionResult<null>> {
  return asResult(async () => {
    const { endpoint, p256dh, auth } = expected(() => validatePushSubscription(input));
    const supabase = await createServerClient();

    const saved = await supabase.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
    if (saved.error) {
      console.error(`Nie udało się zapisać subskrypcji push: ${saved.error.message}`);
      throw new ExpectedError("Nie udało się włączyć powiadomień");
    }

    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    return null;
  });
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult<null>> {
  return asResult(async () => {
    if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 1000) {
      throw new ExpectedError("Nieprawidłowa subskrypcja");
    }
    const supabase = await createServerClient();

    const removed = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (removed.error) {
      console.error(`Nie udało się usunąć subskrypcji push: ${removed.error.message}`);
      throw new ExpectedError("Nie udało się wyłączyć powiadomień");
    }

    revalidatePath("/dzis");
    revalidatePath("/nawyki");
    return null;
  });
}
