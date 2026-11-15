const MAX_LENGTH = 1000;

// Znane serwery push przeglądarek. Ta sama lista jest w save_push_subscription (migracja 0004),
// która jest właściwą ochroną: cron wysyła żądania tylko pod adresy z bazy.
const ALLOWED_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const ALLOWED_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

/** Spłaszcza PushSubscriptionJSON z przeglądarki do pól tabeli push_subscriptions. Zły kształt lub nieznany serwer push → błąd. */
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

  // Host = tekst między "https://" a pierwszym "/" (jak w bazie). Tylko litery, cyfry, "-" i kropki
  // między etykietami, więc odpada userinfo ("@"), port (":"), "\", "?" i "#".
  const host = (endpoint as string).slice("https://".length).split("/")[0].toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host)) throw invalid;
  if (!ALLOWED_HOSTS.includes(host) && !ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw invalid;

  return { endpoint: endpoint as string, p256dh: p256dh as string, auth: auth as string };
}
