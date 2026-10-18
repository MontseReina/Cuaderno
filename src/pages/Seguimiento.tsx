import { Link } from 'react-router-dom'
import { backend, useRows } from '../store'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext, dailyTraffic, symptomsForToday } from '../domain/cycle'
import { entradasVigentes, fmtCorta } from './Pautas'

/** 0.31.0 · «Pautas» va justo después de «Preguntas al equipo».
 *  0.30.0 · Una sola lista, en el orden en que la familia lo consulta. «Emocional y familiar» pasa a «Más». */
const LISTA = [
  { to: '/diagnosticos', ico: '🩺', label: 'Diagnósticos y evolución', desc: 'Línea de tiempo clínica, signos a vigilar, datos del protocolo' },
  { to: '/ciclos', ico: '💉', label: 'Tratamiento y ciclos', desc: 'Quimio, rescate, dosis acumulada, vigilancia por fármaco' },
  { to: '/analiticas', ico: '🧪', label: 'Analíticas y marcadores', desc: 'Fuera de rango, tendencias, pruebas de órgano' },
  { to: '/microbiota', ico: '🦠', label: 'Microbiota', desc: 'Tests de heces y comparativa' },
  { to: '/equipo', ico: '💬', label: 'Preguntas al equipo', desc: 'Por profesional · informe de consulta' },
  { to: '/pautas', ico: '🌱', label: 'Pautas', desc: '' },
  { to: '/pendientes', ico: '☑️', label: 'Pendientes', desc: '' },
  { to: '/informes', ico: '📊', label: 'Evaluaciones e informe semanal', desc: 'Cómo se rellena el registro y el informe de la semana en PDF' },
  { to: '/calendario', ico: '📅', label: 'Calendario', desc: '' },
]

/** Pestaña «Seguimiento» (0.29.0): lo que se consulta, no lo que se apunta cada día. */
export default function Seguimiento() {
  const today = todayStr()
  const patient = backend.all('patients')[0]
  const cycles = useRows('cycles')
  const diagnoses = useRows('diagnoses')
  const logs = useRows('daily_logs')
  const todos = useRows('todos', (t) => t.status === 'pendiente')
  const events = useRows('calendar_events', (e) => e.status === 'previsto')
  const pautas = entradasVigentes(useRows('guidelines'), useRows('questions'))
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const atrasados = todos.filter((t) => { const d = t.do_date ?? t.due_date; return !!d && d < today }).length
  const proximas = events.filter((e) => {
    const diff = new Date(e.start_at).getTime() - Date.now()
    return diff > -3600000 && diff < 48 * 3600000
  }).length
  // Hoy a la izquierda y hacia atrás en el tiempo hacia la derecha.
  const strip = Array.from({ length: 21 }, (_, i) => {
    const d = addDays(today, -i)
    const l = byDate.get(d)
    const c = cycleContext(cycles, d)
    const p = [1, 2].map((n) => byDate.get(addDays(d, -n))).filter((x): x is NonNullable<typeof x> => !!x)
    return { d, level: l ? dailyTraffic(l, p, c, symptomsForToday(c, diagnoses)).level : '' }
  })

  const txtPendientes = todos.length ? `${todos.length} tarea${todos.length > 1 ? 's' : ''}${atrasados ? `, ${atrasados} atrasada${atrasados > 1 ? 's' : ''}` : ''}` : 'Nada pendiente'
  const txtCitas = proximas ? `${proximas} cita${proximas > 1 ? 's' : ''} en 48 h` : 'Sin citas en 48 h'
  const txtPautas = pautas.length ? `${pautas.length} vigente${pautas.length > 1 ? 's' : ''} · la última del ${fmtCorta(pautas[0].date)}` : 'Respuestas, emails y sesiones con los profesionales'
  const desc = (l: { to: string; desc: string }) => (l.to === '/pendientes' ? txtPendientes : l.to === '/calendario' ? txtCitas : l.to === '/pautas' ? txtPautas : l.desc)

  return (
    <div>
      <h1>Seguimiento</h1>
      {LISTA.map((l) => <Fila key={l.to} {...l} desc={desc(l)} />)}

      <div className="card tight" style={{ marginTop: '1rem' }}>
        <h3 style={{ margin: '0 0 .4rem' }}>Cómo ha estado {patient?.name ?? 'el niño'} estos días</h3>
        <div className="strip alta">
          {strip.map((s) => (
            <Link key={s.d} to={`/diario/${s.d}`} style={{ flex: 1, display: 'contents' }}>
              <span className={s.level} title={fmtDate(s.d)} />
            </Link>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: '.4rem' }}>
          Hoy a la izquierda · <span className="dot verde" />sin alarmas <span className="dot amarillo" />vigilar <span className="dot rojo" />alarma · gris: sin registro
        </div>
      </div>
    </div>
  )
}

function Fila({ to, ico, label, desc }: { to: string; ico: string; label: string; desc: string }) {
  return (
    <Link to={to} className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
      <span style={{ fontSize: '1.5rem' }}>{ico}</span>
      <span><strong>{label}</strong><div className="muted small">{desc}</div></span>
    </Link>
  )
}
