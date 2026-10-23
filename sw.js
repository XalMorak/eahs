/* ЭАХС service worker — мэдэгдэл харуулах/дарах + Web Push (v22: сайт хаалттай үед ч мэдэгдэл ирнэ).
   Fetch кэш хийхгүй (апп шинэчлэлт шууд хүрнэ). Push-ийг /api/push-water (VAPID) илгээнэ. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "ЭАХС";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", lang: "mn",
    tag: d.tag || "eahs", renotify: true, data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        try { await c.focus(); } catch (_) {}
        c.postMessage({ type: "eahs-open", url });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
