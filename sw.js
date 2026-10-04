/* ЭАХС service worker — зөвхөн мэдэгдэл харуулах/дарахад.
   Fetch кэш хийхгүй (апп шинэчлэлт шууд хүрнэ). Жинхэнэ push (апп хаалттай үед) нь FCM + сервер шаардана — README-г үзнэ үү. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
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
