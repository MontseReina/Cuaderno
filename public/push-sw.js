/* 0.34.0 · Avisos al móvil: el service worker de la app (Workbox) carga este fichero.
 * Muestra el aviso que manda el servidor y, al tocarlo, abre Huma. */
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { body: event.data ? event.data.text() : '' } }
  const title = d.title || 'Huma'
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // 0.50.0: si Huma ya está abierta, se lleva a la pantalla del aviso (p. ej. el parte del día).
    for (const w of wins) {
      if ('focus' in w) {
        try { if ('navigate' in w && url) await w.navigate(url) } catch (e) { /* sigue */ }
        await w.focus(); return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
