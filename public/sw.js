// Service worker Rhytm: obsługa powiadomień push o nawykach.
self.addEventListener("push", (event) => {
  // Powiadomienie pokazujemy zawsze (userVisibleOnly), nawet gdy payload jest pusty lub nie jest JSON-em.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Rhytm", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/dzis" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dzis";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      // Otwartą kartę aplikacji przenosimy na adres z powiadomienia i skupiamy; gdy jej nie ma, otwieramy nową.
      for (const client of windows) {
        if ("navigate" in client && "focus" in client) {
          // navigate() startujemy przed focus(), ale nie czekamy na nie: focus() musi zajść
          // w czasie obsługi kliknięcia, a nawigacja może trwać dłużej
          const navigation = client.navigate(url).catch(() => null);
          await client.focus().catch(() => null);
          await navigation;
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
