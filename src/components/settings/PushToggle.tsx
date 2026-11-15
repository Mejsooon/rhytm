"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription } from "@/app/(app)/ustawienia/push-actions";

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

// Włączanie i wyłączanie powiadomień push na bieżącym urządzeniu.
export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function detect() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");

        const isIos = /iPhone|iPad/.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        if (isIos && !standalone) return setState("ios-install");
        if (Notification.permission === "denied") return setState("denied");

        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        setState(subscription ? "on" : "off");
      } catch {
        // np. przeglądarka blokuje service workery (tryb prywatny) — pokazujemy przycisk zamiast wiecznego ładowania
        setState("off");
      }
    }
    detect();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;

      // Klucz VAPID z formatu base64url na bajty, jakiego wymaga pushManager.subscribe.
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
      const raw = window.atob(base64);
      const applicationServerKey = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) applicationServerKey[i] = raw.charCodeAt(i);

      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const saved = await savePushSubscription(subscription.toJSON());
      if (!saved.ok) {
        // Bez zapisu na serwerze subskrypcja byłaby martwa, więc ją cofamy.
        await subscription.unsubscribe();
        setError(saved.error);
        return;
      }
      setState("on");
    } catch {
      setError("Nie udało się włączyć powiadomień");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const removed = await removePushSubscription(subscription.endpoint);
        if (!removed.ok) {
          setError(removed.error);
          return;
        }
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Nie udało się wyłączyć powiadomień");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  return (
    <div className="flex max-w-md flex-col items-start gap-3">
      {state === "unsupported" && <p className="text-muted-foreground text-sm">Ta przeglądarka nie obsługuje powiadomień.</p>}
      {state === "ios-install" && (
        <p className="text-muted-foreground text-sm">
          Na iPhonie powiadomienia działają po dodaniu Rhytm do ekranu głównego (Udostępnij → Do ekranu początkowego, iOS 16.4+).
        </p>
      )}
      {state === "denied" && (
        <p className="text-muted-foreground text-sm">Powiadomienia są zablokowane w ustawieniach przeglądarki.</p>
      )}
      {state === "off" && (
        <Button onClick={enable} disabled={busy}>
          Włącz powiadomienia
        </Button>
      )}
      {state === "on" && (
        <>
          <p className="text-sm">Powiadomienia włączone na tym urządzeniu</p>
          <Button variant="outline" onClick={disable} disabled={busy}>
            Wyłącz
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-destructive-foreground text-sm">{error}</p>}
    </div>
  );
}
