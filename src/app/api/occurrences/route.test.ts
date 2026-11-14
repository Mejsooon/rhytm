import { beforeEach, describe, expect, it, vi } from "vitest";

const listOccurrences = vi.fn();
vi.mock("@/lib/calendar/list-occurrences", () => ({
  listOccurrences: (...args: unknown[]) => listOccurrences(...args),
}));

import { GET } from "./route";

describe("GET /api/occurrences", () => {
  beforeEach(() => {
    listOccurrences.mockReset();
  });

  it("zwraca wystąpienia jako JSON dla poprawnego zakresu", async () => {
    listOccurrences.mockResolvedValue([{ blockId: "b1", occurrenceDate: "2026-11-16", start: new Date("2026-11-16T07:00:00Z") }]);
    const res = await GET(new Request("http://localhost/api/occurrences?from=2026-11-16&to=2026-11-22"));
    expect(res.status).toBe(200);
    expect(listOccurrences).toHaveBeenCalledWith("2026-11-16", "2026-11-22");
    expect(await res.json()).toEqual([{ blockId: "b1", occurrenceDate: "2026-11-16", start: "2026-11-16T07:00:00.000Z" }]);
  });

  it("odrzuca brakujący lub zły zakres kodem 400, bez pytania bazy", async () => {
    const res = await GET(new Request("http://localhost/api/occurrences?from=16-11-2026"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Nieprawidłowy zakres dat" });
    expect(listOccurrences).not.toHaveBeenCalled();
  });

  it("zwraca 500 z polskim komunikatem, gdy odczyt się nie uda", async () => {
    listOccurrences.mockImplementation(async () => {
      throw new Error("Nie udało się wczytać bloków: x");
    });
    const res = await GET(new Request("http://localhost/api/occurrences?from=2026-11-16&to=2026-11-22"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Nie udało się wczytać bloków: x" });
  });
});
