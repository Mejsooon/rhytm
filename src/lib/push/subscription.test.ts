import { describe, expect, it } from "vitest";
import { validatePushSubscription } from "./subscription";

const valid = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } };

describe("validatePushSubscription", () => {
  it("zwraca płaski wynik dla poprawnej subskrypcji", () => {
    expect(validatePushSubscription(valid)).toEqual({ endpoint: "https://fcm.googleapis.com/x", p256dh: "a", auth: "b" });
  });

  it.each([
    ["endpoint http://", { ...valid, endpoint: "http://fcm.googleapis.com/x" }],
    ["brak keys", { endpoint: valid.endpoint }],
    ["puste auth", { ...valid, keys: { p256dh: "a", auth: "" } }],
    ["null", null],
    ["endpoint o 1001 znakach", { ...valid, endpoint: "https://" + "a".repeat(993) }],
  ])("odrzuca: %s", (_name, input) => {
    expect(() => validatePushSubscription(input)).toThrow("Nieprawidłowa subskrypcja");
  });
});
