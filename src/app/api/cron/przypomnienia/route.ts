import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

// Bez `export const runtime`: przy cacheComponents Next używa domyślnie Node.js
// i odrzuca ten eksport w route handlerze.

type Reminder = {
  endpoint: string;
  p256dh: string;
  auth: string;
  habit_id: string;
  habit_name: string;
};

// Wywoływany przez pg_cron/pg_net (Supabase): body to wiersze z
// claim_due_habit_reminders, nagłówek Authorization: Bearer <CRON_SECRET>.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Wymagamy dokładnie "Bearer <sekret>"; sam sekret bez prefiksu jest odrzucany.
  const header = request.headers.get("authorization") ?? "";
  const tokenBytes = Buffer.from(header);
  const secretBytes = Buffer.from(`Bearer ${cronSecret ?? ""}`);
  if (
    !cronSecret ||
    tokenBytes.length !== secretBytes.length ||
    !timingSafeEqual(tokenBytes, secretBytes)
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { reminders?: Reminder[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const reminders = body?.reminders;
  if (
    !Array.isArray(reminders) ||
    reminders.some(
      (r) =>
        typeof r?.endpoint !== "string" ||
        typeof r?.p256dh !== "string" ||
        typeof r?.auth !== "string" ||
        typeof r?.habit_id !== "string" ||
        typeof r?.habit_name !== "string",
    )
  ) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const vapidSubject = process.env.VAPID_SUBJECT;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    console.error("Brak konfiguracji VAPID (VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)");
    return Response.json({ error: "vapid not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const results = await Promise.allSettled(
    reminders.map((reminder) =>
      webpush.sendNotification(
        {
          endpoint: reminder.endpoint,
          keys: { p256dh: reminder.p256dh, auth: reminder.auth },
        },
        JSON.stringify({
          title: "Rhytm",
          body: `Pora na: ${reminder.habit_name}`,
          tag: reminder.habit_id,
          url: "/dzis",
        }),
        // timeout: zawieszony serwer push nie może zatrzymać całej wysyłki
        { TTL: 3600, timeout: 10000 },
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }
    failed += 1;
    const endpoint = reminders[index].endpoint;
    const statusCode = (result.reason as { statusCode?: number })?.statusCode;
    // Logujemy tylko status i origin endpointu, bez kluczy ani ścieżki.
    let origin = "unknown";
    try {
      origin = new URL(endpoint).origin;
    } catch {}
    console.error(`Web Push nie powiódł się: status ${statusCode}, ${origin}`);
    if (statusCode === 404 || statusCode === 410) {
      expiredEndpoints.push(endpoint);
    }
  });

  let removed = 0;
  if (expiredEndpoints.length > 0) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase.rpc("remove_push_subscriptions", {
      p_secret: cronSecret,
      p_endpoints: expiredEndpoints,
    });
    if (error) {
      console.error(`Usuwanie subskrypcji nie powiodło się: ${error.message}`);
    } else {
      removed = typeof data === "number" ? data : 0;
    }
  }

  return Response.json({ sent, failed, removed });
}
