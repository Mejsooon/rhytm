// Service worker Rhytm: obsługa powiadomień push o nawykach.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, tag, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dzis";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Skupiamy już otwartą kartę aplikacji, a gdy jej nie ma, otwieramy adres z powiadomienia.
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
