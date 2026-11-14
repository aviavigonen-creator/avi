// Service Worker של פאנל הניהול: התראות פוש
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "הודעה חדשה", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "מנות של פורים", {
    body: d.body || "", icon: "media/admin-icon.png", badge: "media/admin-icon.png", dir: "rtl", lang: "he",
    tag: d.tag || "mishlohi", renotify: true, vibrate: [200, 100, 200], data: { url: d.url || "./admin.html" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./admin.html", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(url.split("#")[0]) && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
