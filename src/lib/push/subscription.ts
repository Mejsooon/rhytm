const MAX_LENGTH = 1000;

/** Spłaszcza PushSubscriptionJSON z przeglądarki do pól tabeli push_subscriptions. Zły kształt → błąd. */
export function validatePushSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } {
  const invalid = new Error("Nieprawidłowa subskrypcja");
  if (typeof input !== "object" || input === null) throw invalid;

  const { endpoint, keys } = input as { endpoint?: unknown; keys?: unknown };
  if (typeof keys !== "object" || keys === null) throw invalid;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };

  for (const value of [endpoint, p256dh, auth]) {
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) throw invalid;
  }
  if (!(endpoint as string).startsWith("https://")) throw invalid;

  return { endpoint: endpoint as string, p256dh: p256dh as string, auth: auth as string };
}
