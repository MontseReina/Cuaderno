import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { backend, currentPatientId, faltaTabla, isDemo, save, remove, useRows } from '../store'
import { SupabaseBackend } from '../store/supabase'
import { AGUA_DIA_ML, DIAS_SIN_DEPOSICION, DIAS_SIN_PESO, ml } from '../domain/avisos'
import { fmtDateTime } from '../domain/dates'

/** Clave pública VAPID de Huma (la privada vive solo en los secretos de la función del servidor). */
export const VAPID_PUBLIC_KEY = 'BBolZMh77Knm5-W_GO0T3e4BFUN8LHtner7prWFH_x88fp7o6XRSBFguxY_eYKtvIhmICBpiW4ZiHmn5iD0JGrw'

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const esIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
const nombreMovil = () => /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Otro'
const instalada = () => typeof window !== 'undefined' && ((navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)
const soportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function claveBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4))
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
const b64url = (buf: ArrayBuffer | null) => {
  if (!buf) return ''
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Más → 🔔 Avisos al móvil (0.34.0): activar los avisos en este móvil, mandar uno de prueba y ver quién los recibe. */
export default function Avisos() {
  const subs = useRows('push_subscriptions')
  const profiles = useRows('profiles')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [permiso, setPermiso] = useState<NotificationPermission | 'no'>(soportado() ? Notification.permission : 'no')
  const [msg, setMsg] = useState<{ txt: string; ok: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const yo = backend.currentUserId()

  useEffect(() => {
    if (!soportado()) return
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setEndpoint(s?.endpoint ?? null)).catch(() => {})
  }, [])

  const mia = subs.find((s) => s.endpoint === endpoint)
  const activo = !!endpoint && !!mia && permiso === 'granted'

  const activar = async () => {
    setMsg(null); setOcupado(true)
    try {
      const p = await Notification.requestPermission()
      setPermiso(p)
      if (p !== 'granted') { setMsg({ ok: false, txt: 'El móvil no ha dado permiso. Mira «Si pulsaste No permitir» más abajo.' }); return }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(VAPID_PUBLIC_KEY) })
      const ex = subs.find((s) => s.endpoint === sub!.endpoint)
      await save('push_subscriptions', {
        ...(ex ?? {}),
        patient_id: currentPatientId(),
        user_id: yo,
        endpoint: sub.endpoint,
        p256dh: b64url(sub.getKey('p256dh')),
        auth: b64url(sub.getKey('auth')),
        device: nombreMovil(),
        last_error: null,
      } as never)
      setEndpoint(sub.endpoint)
      setMsg({ ok: true, txt: 'Avisos activados en este móvil. Ahora pulsa «Enviar aviso de prueba».' })
    } catch (e) {
      setMsg({ ok: false, txt: 'No se han podido activar: ' + (e instanceof Error ? e.message : String(e)) })
    } finally { setOcupado(false) }
  }

  const prueba = async () => {
    setMsg(null); setOcupado(true)
    try {
      const client = (backend as SupabaseBackend).client
      const { data, error } = await client.functions.invoke('avisos', { body: { accion: 'prueba' } })
      if (error) throw error
      const r = data as { enviados: number; total: number; errores?: string[] }
      setMsg(r.enviados > 0
        ? { ok: true, txt: `Aviso de prueba mandado a ${r.enviados} ${r.enviados === 1 ? 'móvil' : 'móviles'}. Tiene que llegar en unos segundos.` }
        : { ok: false, txt: r.errores?.[0] ?? 'No se ha podido mandar el aviso de prueba.' })
    } catch (e) {
      setMsg({ ok: false, txt: 'No se ha podido mandar: ' + (e instanceof Error ? e.message : String(e)) })
    } finally { setOcupado(false) }
  }

  const desactivar = async () => {
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.getSubscription()
      await s?.unsubscribe()
      if (mia) await remove('push_subscriptions', mia.id)
      setEndpoint(null)
      setMsg({ ok: true, txt: 'Avisos desactivados en este móvil.' })
    } finally { setOcupado(false) }
  }

  const nombre = (id: string) => profiles.find((p) => p.id === id)?.name ?? 'Usuario'

  return (
    <div className="avisos-movil">
      <h1>🔔 Avisos al móvil</h1>
      <p className="muted">Huma avisa cuando, a una hora concreta, el día va por detrás de lo que tocaría. Si todo va bien, no llega nada.</p>

      <div className="card">
        <h3>Este móvil</h3>
        {isDemo ? <p className="muted small">En la demo no hay avisos: funcionan en la app real.</p>
          : faltaTabla('push_subscriptions') ? <p className="muted small">Falta preparar los avisos en el servidor. Montserrate os avisará cuando estén listos.</p>
          : !soportado() || (esIOS && !instalada()) ? (
            <div className="aviso-ayuda small">
              {esIOS
                ? <>En iPhone los avisos solo funcionan si abres Huma <strong>desde su icono de la pantalla de inicio</strong>, no desde Safari. Si no tienes el icono: Safari → botón Compartir → «Añadir a pantalla de inicio». Si ya lo abres desde el icono, el iPhone necesita iOS 16.4 o posterior.</>
                : <>Este navegador no puede recibir avisos. En Android, abre Huma con Chrome.</>}
            </div>
          ) : (
            <>
              <p className="small">{activo ? <>✅ <strong>Activados</strong> en este móvil ({mia?.device}).</> : permiso === 'denied' ? '⛔ Este móvil tiene los avisos de Huma bloqueados.' : 'Los avisos no están activados en este móvil.'}</p>
              <div className="row wrap" style={{ gap: '.5rem' }}>
                {!activo && <button className="btn" disabled={ocupado} onClick={activar}>Activar avisos en este móvil</button>}
                {activo && <button className="btn" disabled={ocupado} onClick={prueba}>Enviar aviso de prueba</button>}
                {activo && <button className="btn secondary sm" disabled={ocupado} onClick={desactivar}>Desactivar en este móvil</button>}
              </div>
            </>
          )}
        {msg && <p className={'small ' + (msg.ok ? 'ok-txt' : 'error-txt')} role="status">{msg.txt}</p>}
      </div>

      {subs.length > 0 && (
        <div className="card">
          <h3>Quién los recibe</h3>
          <ul className="lista-simple small">
            {subs.map((s) => (
              <li key={s.id}>
                <strong>{nombre(s.user_id)}</strong> · {s.device ?? 'móvil'}{s.endpoint === endpoint ? ' (este)' : ''}
                <span className="muted"> · {s.last_ok_at ? `último aviso recibido ${fmtDateTime(s.last_ok_at)}` : 'aún sin avisos'}</span>
                {s.last_error && <span className="error-txt"> · último fallo: {s.last_error.slice(0, 60)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Qué avisos llegan</h3>
        <table className="tabla-avisos small">
          <tbody>
            <tr><td><strong>12:00</strong></td><td>Agua (unos 500 ml), tomas, temperatura de la mañana y peso si lleva {DIAS_SIN_PESO} días sin pesarle</td></tr>
            <tr><td><strong>16:00</strong></td><td>Agua (unos 900 ml) y tomas</td></tr>
            <tr><td><strong>19:00</strong></td><td>Agua (unos 1.250 ml), tomas, temperatura de la tarde, la cena si aún no está (como tarde a las 19:30) y deposiciones si lleva {DIAS_SIN_DEPOSICION} días sin ninguna</td></tr>
            <tr><td><strong>21:00</strong></td><td>Lo que queda por rellenar. A las 00:00 el día se cierra</td></tr>
            <tr><td><strong>Tras la cena</strong></td><td>A las 2 h de terminar de cenar: a la cama</td></tr>
            <tr><td><strong>21:30</strong></td><td>Hora límite del desayuno de mañana (va en el aviso de la cama si coinciden)</td></tr>
            <tr><td><strong>Mañana</strong></td><td>Ayuno: a las 11 h y a las 12 h desde la última toma</td></tr>
          </tbody>
        </table>
        <p className="muted small">Meta de líquidos: {ml(AGUA_DIA_ML)} ml al día (el batido cuenta). Tomas: 4 en semana de quimio y 5 en el resto. Las cantidades de agua se ajustan a la hora de despertar apuntada en Biohacking. Todos los avisos quedan guardados en <Link to="/informes">📊 Evaluaciones</Link>.</p>
      </div>

      <details className="section">
        <summary><span>Si pulsaste «No permitir» o no llegan</span></summary>
        <ul className="small">
          <li><strong>iPhone:</strong> Ajustes → Notificaciones → Huma → activar «Permitir notificaciones». Después, aquí, «Activar avisos en este móvil».</li>
          <li><strong>Android:</strong> Ajustes → Aplicaciones → Chrome → Notificaciones → activar. Y en Batería, «Sin restricciones», para que no lleguen tarde.</li>
          <li>Con «No molestar» o el modo Dormir, añade Huma a las apps permitidas.</li>
          <li>Si borras el icono, cambias de móvil o cierras sesión, hay que volver a activarlos.</li>
        </ul>
      </details>
    </div>
  )
}
