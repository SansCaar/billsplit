/* Bill Split service worker: shows Notifications and opens the right page when one is tapped. No offline caching. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Bill Split", {
      body: d.body || "",
      tag: d.tag,
      renotify: Boolean(d.tag),
      icon: "/icon-192.png",
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of windows) {
        if (new URL(c.url).origin !== self.location.origin) continue;
        try {
          const nav = c.url === url ? c : await c.navigate(url);
          if (nav) return nav.focus();
        } catch {
          /* not controlled by us yet: fall through to a new window */
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
