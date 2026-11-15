import { describe, expect, it } from "vitest";
import { validatePushSubscription } from "./subscription";

const valid = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } };

describe("validatePushSubscription", () => {
  it("zwraca płaski wynik dla poprawnej subskrypcji", () => {
    expect(validatePushSubscription(valid)).toEqual({ endpoint: "https://fcm.googleapis.com/x", p256dh: "a", auth: "b" });
  });

  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://api.push.apple.com/abc",
    "https://wns2-db5p.notify.windows.com/w/?token=abc",
    "https://FCM.GoogleAPIs.com/fcm/send/abc",
  ])("przyjmuje znany serwer push: %s", (endpoint) => {
    expect(validatePushSubscription({ ...valid, endpoint }).endpoint).toBe(endpoint);
  });

  it.each([
    ["endpoint http://", { ...valid, endpoint: "http://fcm.googleapis.com/x" }],
    ["adres metadanych chmury", { ...valid, endpoint: "http://169.254.169.254/x" }],
    ["obcy host", { ...valid, endpoint: "https://evil.example/x" }],
    ["dozwolony host jako poddomena obcego", { ...valid, endpoint: "https://fcm.googleapis.com.evil.com/x" }],
    ["userinfo przed hostem", { ...valid, endpoint: "https://user@fcm.googleapis.com/x" }],
    ["userinfo przed sufiksem", { ...valid, endpoint: "https://x@api.push.apple.com/x" }],
    ["port", { ...valid, endpoint: "https://fcm.googleapis.com:8443/x" }],
    ["backslash przed sufiksem", { ...valid, endpoint: "https://evil.com\\.push.apple.com/x" }],
    ["pusta etykieta przed sufiksem", { ...valid, endpoint: "https://.push.apple.com/x" }],
    ["sam sufiks bez poddomeny", { ...valid, endpoint: "https://push.apple.com/x" }],
    ["brak keys", { endpoint: valid.endpoint }],
    ["puste auth", { ...valid, keys: { p256dh: "a", auth: "" } }],
    ["auth o 1001 znakach", { ...valid, keys: { p256dh: "a", auth: "a".repeat(1001) } }],
    ["null", null],
    ["endpoint o 1001 znakach", { ...valid, endpoint: "https://fcm.googleapis.com/" + "a".repeat(974) }],
  ])("odrzuca: %s", (_name, input) => {
    expect(() => validatePushSubscription(input)).toThrow("Nieprawidłowa subskrypcja");
  });
});
