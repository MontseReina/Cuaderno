import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/app.css'

// Versión de un solo fichero (GitHub Pages): registra un service worker mínimo para funcionar sin conexión.
if (import.meta.env.VITE_SINGLEFILE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin sw.js (p. ej. demo publicada): funciona igual, sin caché offline */ })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
