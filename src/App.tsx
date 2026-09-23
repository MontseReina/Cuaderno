import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, Link } from 'react-router-dom'
import { backend, isDemo, useRows, useStoreVersion } from './store'
import { todayStr } from './domain/dates'
import Home from './pages/Home'
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
import PinGate from './pages/PinGate'
import { pinUnlocked } from './domain/pin'
import { APP_VERSION } from './domain/exporter'

export default function App() {
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(pinUnlocked())
  useEffect(() => {
    backend.init().then(() => setReady(true))
  }, [])
  useStoreVersion()
  if (!ready) return <div className="empty">Cargando…</div>
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
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="title" style={{ color: '#fff', textDecoration: 'none' }}>Cuaderno de cuidados</Link>
        <Link to="/pendientes" className={'badge ' + (overdue ? 'alert' : todos.length ? 'warn' : '')} title="Pendientes">
          ☑ {todos.length}
        </Link>
        <Link to="/calendario" className={'badge ' + (soon ? 'warn' : '')} title="Próximas 48 h">
          📅 {soon}
        </Link>
        {isDemo && <Link to="/datos" className="badge" title={`v${APP_VERSION} · los datos se guardan solo en este dispositivo`}>💾</Link>}
      </header>
      <nav className="tabbar">
        <Tab to="/" ico="🏠" label="Inicio" />
        <Tab to="/diario" ico="📝" label="Registro diario" />
        <Tab to="/medicacion" ico="💊" label="Medicación" />
        <Tab to="/nutricion" ico="🥣" label="Nutrición" />
        <Tab to="/hidratacion" ico="💧" label="Hidratación" />
        <Tab to="/ejercicio" ico="🏃" label="Ejercicio" />
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diario" element={<Diario />} />
          <Route path="/diario/:date" element={<Diario />} />
          <Route path="/ciclos" element={<Ciclos />} />
          <Route path="/diagnosticos" element={<Diagnosticos />} />
          <Route path="/medicacion" element={<Medicacion />} />
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
        </Routes>
      </main>
    </div>
  )
}

function Tab({ to, ico, label }: { to: string; ico: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ico">{ico}</span>
      {label}
    </NavLink>
  )
}
