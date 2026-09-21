import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/app.css'
import { registerSW } from 'virtual:pwa-register'

// Versión de un solo fichero (GitHub Pages): registra un service worker mínimo para funcionar sin conexión.
if (import.meta.env.VITE_SINGLEFILE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin sw.js (p. ej. demo publicada): funciona igual, sin caché offline */ })
}

// Versión publicada (PWA): cuando hay una versión nueva, se instala sola y la página se recarga
// una vez para mostrarla. Además se comprueba cada 30 minutos si hay versión nueva mientras está abierta.
if (!import.meta.env.VITE_SINGLEFILE) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url: string, reg?: ServiceWorkerRegistration) {
      if (reg) setInterval(() => { reg.update().catch(() => {}) }, 30 * 60 * 1000)
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
