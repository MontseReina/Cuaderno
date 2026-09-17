// Service worker mínimo: guarda la app en caché para abrirla sin conexión (GitHub Pages).
const CACHE = 'cuaderno-v1'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html']))); self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(clients.claim()) })
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))))
})
