import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import { backend, isDemo, useRows, useStoreVersion } from './store'
import { todayStr } from './domain/dates'
import Hoy from './pages/Hoy'
import Seguimiento from './pages/Seguimiento'
import Diario from './pages/Diario'
import Ciclos from './pages/Ciclos'
import Diagnosticos from './pages/Diagnosticos'
import Medicacion from './pages/Medicacion'
import Analiticas from './pages/Analiticas'
import Calendario from './pages/Calendario'
import Pendientes from './pages/Pendientes'
import Equipo from './pages/Equipo'
import Emocional from './pages/Emocional'
import Ejercicio from './pages/Ejercicio'
import Microbiota from './pages/Microbiota'
import Ajustes from './pages/Ajustes'
import Mas from './pages/Mas'
import Nutricion from './pages/Nutricion'
import Biohacking from './pages/Biohacking'
import Hidratacion from './pages/Hidratacion'
import Biblioteca from './pages/Biblioteca'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Datos from './pages/Datos'
import Reto from './pages/Reto'
import Informes from './pages/Informes'
import { AvisoVersion } from './components/AvisoVersion'
import { ConfirmarHost } from './components/Confirmar'
import PinGate from './pages/PinGate'
import { pinUnlocked } from './domain/pin'
import { APP_VERSION } from './domain/exporter'
import { Mark } from './components/Logo'
import { HumaArt } from './components/Huma'
import { BandaSalud, usePendienteRojo, useSaludHoy } from './components/Salud'
import { ApartadosNav, esApartado } from './components/Apartados'

export default function App() {
  const [ready, setReady] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(pinUnlocked())
  const cargar = () => {
    setReady(false)
    setFallo(null)
    backend.init().then((e) => { setFallo(e ?? null); setReady(true) })
  }
  useEffect(cargar, [])
  useStoreVersion()
  if (!ready) return <div className="empty">Cargando…</div>
  // Nunca mostrar la app vacía cuando no se han podido leer los datos: parecería que se han borrado.
  if (fallo) return (
    <div className="content">
      <div className="card">
        <h1>No se han podido cargar los datos</h1>
        <p><strong>Tus registros están guardados en el servidor.</strong> Lo que ha fallado es leerlos en este momento, normalmente por falta de cobertura o porque la sesión ha caducado.</p>
        <p className="notice"><strong>No apuntes nada todavía</strong>: espera a que vuelvan a verse, para no duplicar el registro del día.</p>
        <div className="row">
          <button className="btn" onClick={cargar}>Reintentar</button>
          <button className="btn ghost" onClick={async () => { await (backend as unknown as { signOut?: () => Promise<void> }).signOut?.(); location.reload() }}>Entrar otra vez</button>
        </div>
        <p className="muted small">Detalle técnico: {fallo}</p>
      </div>
    </div>
  )
  if (isDemo && !unlocked) return <PinGate onOk={() => setUnlocked(true)} />
  if (!backend.currentUserId()) return <Login />
  const patient = backend.all('patients')[0]
  if (!patient) return <Setup />
  return <Shell />
}

function Shell() {
  // Registrar el perfil del usuario actual para que aparezca en "asignar a".
  useEffect(() => {
    const me = backend.currentUserId()
    if (me && !backend.all('profiles').some((p) => p.id === me)) {
      backend.upsert('profiles', { id: me, name: backend.currentUserName() })
    }
  }, [])
  const todos = useRows('todos', (t) => t.status === 'pendiente')
  const today = todayStr()
  const overdue = todos.filter((t) => t.priority === 'urgente' || (t.due_date && t.due_date < today)).length
  const events = useRows('calendar_events', (e) => e.status === 'previsto')
  const soon = events.filter((e) => {
    const diff = new Date(e.start_at).getTime() - Date.now()
    return diff > -3600000 && diff < 48 * 3600000
  }).length
  // Salud de hoy: la banda roja se ve en todas las pantallas de los cuidadores.
  const salud = useSaludHoy()
  usePendienteRojo(salud.traffic.level, salud.traffic.reasons)
  const { pathname } = useLocation()
  // Modo niño: el Reto ocupa toda la pantalla, sin barras ni accesos a lo clínico.
  const nino = pathname === '/reto' || pathname.startsWith('/reto/')
  const rojo = salud.traffic.level === 'rojo'
  const zona = zonaDe(pathname)
  if (nino) return (
    <div className="app modo-nino">
      <main className="content">
        <ConfirmarHost />
        <SalirModoNino />
        <Routes>
          <Route path="/reto" element={<Reto />} />
          <Route path="/reto/:section" element={<Reto />} />
        </Routes>
      </main>
    </div>
  )
  return (
    <div className={'app' + (rojo ? ' con-banda' : '')}>
      <div className="cabecera noprint">
        <header className="topbar">
          <Link to="/" className="title" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Mark size={26} />
            Huma
          </Link>
          <Link to="/pendientes" className={'badge ' + (overdue ? 'alert' : todos.length ? 'warn' : '')} title="Pendientes">
            ☑ {todos.length}
          </Link>
          <Link to="/calendario" className={'badge ' + (soon ? 'warn' : '')} title="Próximas 48 h">
            📅 {soon}
          </Link>
          {isDemo && <Link to="/datos" className="badge" title={`v${APP_VERSION} · los datos se guardan solo en este dispositivo`}>💾</Link>}
        </header>
        {rojo && <BandaSalud reasons={salud.traffic.reasons} phone={salud.patient?.phone_oncology} />}
      </div>
      <nav className="tabbar noprint">
        <Tab to="/" ico="🏠" label="Hoy" active={zona === 'hoy'} />
        <Tab to="/reto" ico={<HumaArt k="fenix" size={24} className="tab-huma" silueta />} label="Reto" active={false} />
        <Tab to="/seguimiento" ico="📊" label="Seguimiento" active={zona === 'seguimiento'} />
        <Tab to="/mas" ico="🧭" label="Más" active={zona === 'mas'} />
      </nav>
      <main className="content">
        <AvisoVersion />
        <ConfirmarHost />
        {esApartado(pathname) && <ApartadosNav />}
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/inicio" element={<Hoy />} />
          <Route path="/seguimiento" element={<Seguimiento />} />
          <Route path="/diario" element={<Diario />} />
          <Route path="/diario/:date" element={<Diario />} />
          <Route path="/ciclos" element={<Ciclos />} />
          <Route path="/diagnosticos" element={<Diagnosticos />} />
          <Route path="/medicacion" element={<Medicacion />} />
          <Route path="/medicacion/:date" element={<Medicacion />} />
          <Route path="/analiticas" element={<Analiticas />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/pendientes" element={<Pendientes />} />
          <Route path="/pendientes/:id" element={<Pendientes />} />
          <Route path="/equipo" element={<Equipo />} />
          <Route path="/emocional" element={<Emocional />} />
          <Route path="/ejercicio" element={<Ejercicio />} />
          <Route path="/ejercicio/:date" element={<Ejercicio />} />
          <Route path="/microbiota" element={<Microbiota />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/mas" element={<Mas />} />
          <Route path="/nutricion" element={<Nutricion />} />
          <Route path="/nutricion/:date" element={<Nutricion />} />
          <Route path="/hidratacion" element={<Hidratacion />} />
          <Route path="/hidratacion/:date" element={<Hidratacion />} />
          <Route path="/biohacking" element={<Biohacking />} />
          <Route path="/biohacking/:date" element={<Biohacking />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/datos" element={<Datos />} />
          <Route path="/informes" element={<Informes />} />
          <Route path="/informes/:kind" element={<Informes />} />
          <Route path="/informes/:kind/:date" element={<Informes />} />
        </Routes>
      </main>
    </div>
  )
}

/** A qué pestaña pertenece cada pantalla (las seis del registro diario cuelgan de «Hoy»). */
const SEGUIMIENTO = ['/seguimiento', '/informes', '/ciclos', '/analiticas', '/diagnosticos', '/microbiota', '/calendario', '/pendientes', '/equipo', '/emocional']
const MAS = ['/mas', '/biblioteca', '/datos', '/ajustes']
function zonaDe(path: string): 'hoy' | 'seguimiento' | 'mas' {
  const en = (l: string[]) => l.some((p) => path === p || path.startsWith(p + '/'))
  return en(SEGUIMIENTO) ? 'seguimiento' : en(MAS) ? 'mas' : 'hoy'
}

function Tab({ to, ico, label, active }: { to: string; ico: ReactNode; label: string; active: boolean }) {
  return (
    <Link to={to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
      <span className="ico">{ico}</span>
      {label}
    </Link>
  )
}

/** Salida del modo niño: hay que mantener pulsado, para que no se salga sin querer. */
const PULSACION_MS = 1200
function SalirModoNino() {
  const nav = useNavigate()
  const timer = useRef<number | null>(null)
  const [pulsando, setPulsando] = useState(false)
  const soltar = () => { if (timer.current != null) { clearTimeout(timer.current); timer.current = null } setPulsando(false) }
  const pulsar = () => { soltar(); setPulsando(true); timer.current = window.setTimeout(() => { timer.current = null; nav('/') }, PULSACION_MS) }
  useEffect(() => soltar, [])
  return (
    <div className="nino-salir noprint">
      <button
        type="button"
        className={'nino-salir-btn' + (pulsando ? ' pulsando' : '')}
        onPointerDown={pulsar} onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) pulsar() }} onKeyUp={soltar}
        onContextMenu={(e) => e.preventDefault()}
      >
        🔒 Mantén pulsado para salir
      </button>
    </div>
  )
}
