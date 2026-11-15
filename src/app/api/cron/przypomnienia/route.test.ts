import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotification, setVapidDetails, rpc } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("web-push", () => ({ sendNotification, setVapidDetails }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

import { POST } from "./route";

const reminderWoda = {
  endpoint: "https://push.example.com/send/woda",
  p256dh: "p256-woda",
  auth: "auth-woda",
  habit_id: "habit-woda",
  habit_name: "Woda",
};
const reminderBieg = {
  endpoint: "https://push.example.com/send/bieg",
  p256dh: "p256-bieg",
  auth: "auth-bieg",
  habit_id: "habit-bieg",
  habit_name: "Bieg",
};

function makeRequest(
  body: unknown,
  token: string | null = "sekret",
  authorization: string | null = token === null ? null : `Bearer ${token}`,
) {
  return new Request("http://localhost/api/cron/przypomnienia", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization === null ? {} : { authorization }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.CRON_SECRET = "sekret";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  sendNotification.mockResolvedValue({ statusCode: 201 });
  rpc.mockResolvedValue({ data: 1, error: null });
});

describe("POST /api/cron/przypomnienia", () => {
  it("zwraca 401 przy złym tokenie i nie wysyła", async () => {
    const res = await POST(makeRequest({ reminders: [reminderWoda] }, "zly"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy złym tokenie tej samej długości", async () => {
    const res = await POST(makeRequest({ reminders: [reminderWoda] }, "sekreT"));
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy samym sekrecie bez prefiksu Bearer", async () => {
    const res = await POST(
      makeRequest({ reminders: [reminderWoda] }, null, "sekret"),
    );
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy innym prefiksie niż dokładnie 'Bearer '", async () => {
    const res = await POST(
      makeRequest({ reminders: [reminderWoda] }, null, "bearer sekret"),
    );
    expect(res.status).toBe(401);
    const res2 = await POST(
      makeRequest({ reminders: [reminderWoda] }, null, "Bearer  sekret"),
    );
    expect(res2.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 500, gdy brakuje konfiguracji VAPID, i nie wysyła", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await POST(makeRequest({ reminders: [reminderWoda] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "vapid not configured" });
    expect(setVapidDetails).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("brak VAPID nie zdradza się bez poprawnego tokenu (najpierw 401)", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await POST(makeRequest({ reminders: [reminderWoda] }, "zly"));
    expect(res.status).toBe(401);
  });

  it("zwraca 401 bez nagłówka Authorization", async () => {
    const res = await POST(makeRequest({ reminders: [reminderWoda] }, null));
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401, gdy CRON_SECRET nie jest ustawiony", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest({ reminders: [reminderWoda] }, ""));
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 400 przy złym body", async () => {
    const res = await POST(makeRequest({ reminders: "nie tablica" }));
    expect(res.status).toBe(400);
    const res2 = await POST(makeRequest("{nie json"));
    expect(res2.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("410 liczy się jako failed i removed, a rpc dostaje ten endpoint", async () => {
    sendNotification.mockImplementation(async (subscription) => {
      if (subscription.endpoint === reminderBieg.endpoint) {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
      return { statusCode: 201 };
    });

    const res = await POST(
      makeRequest({ reminders: [reminderWoda, reminderBieg] }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 1, removed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("remove_push_subscriptions", {
      p_secret: "sekret",
      p_endpoints: [reminderBieg.endpoint],
    });
  });

  it("500 z usługi push liczy się jako failed, ale nie jest usuwane", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("boom"), { statusCode: 500 }),
    );

    const res = await POST(makeRequest({ reminders: [reminderWoda] }));

    expect(await res.json()).toEqual({ sent: 0, failed: 1, removed: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("wysyła payload { title, body, tag, url } z TTL 3600 i timeoutem 10 s", async () => {
    await POST(makeRequest({ reminders: [reminderWoda] }));

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payload, options] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: reminderWoda.endpoint,
      keys: { p256dh: "p256-woda", auth: "auth-woda" },
    });
    expect(JSON.parse(payload)).toEqual({
      title: "Rhytm",
      body: "Pora na: Woda",
      tag: "habit-woda",
      url: "/dzis",
    });
    expect(options).toEqual({ TTL: 3600, timeout: 10000 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
