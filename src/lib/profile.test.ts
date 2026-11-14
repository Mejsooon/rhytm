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
// Kategorie: select(count, head) → { count }, insert → { error }.
let categoryCount = 0;
const categoriesSelect = vi.fn(async () => ({ count: categoryCount, error: null }));
const categoriesInsert = vi.fn(async (_rows: unknown) => {
  calls.push("insert categories");
  return { error: null as { code?: string; message: string } | null };
});
const from = vi.fn((table: string) =>
  table === "categories" ? { select: categoriesSelect, insert: categoriesInsert } : { upsert, select },
);

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_1" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => ({ from }) }));

import { ensureCategories, ensureProfile } from "@/lib/profile";

describe("ensureProfile", () => {
  beforeEach(() => {
    calls.length = 0;
    categoryCount = 1;
    vi.clearAllMocks();
  });

  it("najpierw robi idempotentny upsert, potem odczyt", async () => {
    const profile = await ensureProfile();
    expect(calls).toEqual(["upsert", "select"]);
    expect(categoriesInsert).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith({ user_id: "user_1" }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(profile.timezone).toBe("Europe/Warsaw");
  });

  it("przy braku kategorii robi upsert, insert kategorii, potem odczyt", async () => {
    categoryCount = 0;
    await ensureProfile();
    expect(calls).toEqual(["upsert", "insert categories", "select"]);
  });

  it("rzuca błąd, gdy zapytanie o liczbę kategorii się nie powiedzie", async () => {
    categoriesSelect.mockResolvedValueOnce({ count: null as never, error: { message: "count boom" } as never });
    await expect(ensureProfile()).rejects.toThrow("ensureCategories: count boom");
    expect(single).not.toHaveBeenCalled();
  });

  it("rzuca błąd, gdy upsert się nie powiedzie", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "boom" } } as never);
    await expect(ensureProfile()).rejects.toThrow("ensureProfile: boom");
    expect(single).not.toHaveBeenCalled();
  });
});

describe("ensureCategories", () => {
  beforeEach(() => {
    calls.length = 0;
    categoryCount = 0;
    vi.clearAllMocks();
  });

  it("wstawia 4 domyślne jednym insertem, gdy brak kategorii", async () => {
    await ensureCategories();
    expect(categoriesInsert).toHaveBeenCalledTimes(1);
    expect(categoriesInsert).toHaveBeenCalledWith([
      { name: "Nauka", color: "blue", position: 0 },
      { name: "Uczelnia", color: "teal", position: 1 },
      { name: "Praca", color: "gray", position: 2 },
      { name: "Osobiste", color: "rose", position: 3 },
    ]);
  });

  it("nic nie wstawia, gdy użytkownik ma już kategorie", async () => {
    categoryCount = 2;
    await ensureCategories();
    expect(categoriesInsert).not.toHaveBeenCalled();
  });

  it("błąd unikalności 23505 (równoległe wejście) uznaje za sukces", async () => {
    categoriesInsert.mockResolvedValueOnce({ error: { code: "23505", message: "dup" } });
    await expect(ensureCategories()).resolves.toBeUndefined();
  });

  it("inny błąd insertu jest rzucany", async () => {
    categoriesInsert.mockResolvedValueOnce({ error: { code: "42501", message: "denied" } });
    await expect(ensureCategories()).rejects.toThrow("ensureCategories: denied");
  });
});
