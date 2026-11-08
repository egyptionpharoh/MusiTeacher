// Service Worker لمنبّه الحصص الذكي (نطاقه صفحة المنبه فقط: /dashboard/tools/class-alarm)
// مهمته: عرض إشعارات النظام (ضروري على Android) والتعامل مع النقر عليها.
// لا يعترض أي طلبات شبكة ولا يخزن صفحات المنصة، حتى لا يؤثر على بقية MusiTeacher.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || self.registration.scope;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ type: 'class-alarm-ack', id: data.id });
        try { await c.focus(); } catch (e) { /* */ }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
