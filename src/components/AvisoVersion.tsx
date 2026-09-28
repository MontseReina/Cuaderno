import { useEffect, useState } from 'react'
import { APP_VERSION } from '../domain/exporter'

/** Aviso «Hay una versión nueva» (0.23.0). El móvil a veces se queda con una versión guardada;
 *  al abrir la app, al volver a ella y cada 10 minutos se mira version.json sin caché. Si no coincide,
 *  un botón borra la versión guardada y recarga. */
async function versionPublicada(): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    return ((await r.json()) as { version?: string }).version ?? null
  } catch { return null }
}

async function actualizar() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = await caches?.keys?.() ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch { /* seguimos: la recarga basta en la mayoría de casos */ }
  location.reload()
}

export function AvisoVersion() {
  const [nueva, setNueva] = useState<string | null>(null)
  useEffect(() => {
    if (import.meta.env.VITE_SINGLEFILE) return
    const mirar = async () => { const v = await versionPublicada(); setNueva(v && v !== APP_VERSION ? v : null) }
    mirar()
    const t = setInterval(mirar, 10 * 60 * 1000)
    const vis = () => { if (document.visibilityState === 'visible') mirar() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])
  if (!nueva) return null
  return (
    <div className="aviso-version" role="status">
      <span>Hay una versión nueva de la app ({nueva}). Tienes la {APP_VERSION}.</span>
      <button type="button" className="btn sm" onClick={actualizar}>Actualizar</button>
    </div>
  )
}
