import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const upsert = vi.fn(async () => {
  calls.push("upsert");
  return { error: null };
});
const single = vi.fn(async () => {
  calls.push("select");
  return { data: { user_id: "user_1", timezone: "Europe/Warsaw" }, error: null };
});
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ upsert, select }));

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_1" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ from }) }));

import { ensureProfile } from "@/lib/profile";

describe("ensureProfile", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("najpierw robi idempotentny upsert, potem odczyt", async () => {
    const profile = await ensureProfile();
    expect(calls).toEqual(["upsert", "select"]);
    expect(upsert).toHaveBeenCalledWith({ user_id: "user_1" }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(profile.timezone).toBe("Europe/Warsaw");
  });

  it("rzuca błąd, gdy upsert się nie powiedzie", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "boom" } } as never);
    await expect(ensureProfile()).rejects.toThrow("ensureProfile: boom");
    expect(single).not.toHaveBeenCalled();
  });
});
