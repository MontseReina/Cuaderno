import { Link } from 'react-router-dom'
import { backend, useRows, save } from '../store'
import { addDays, fmtDate, fmtWall } from '../domain/dates'
import { afterChemoGate, corticoidAlert } from '../domain/cycle'
import { dayCompleteness } from '../domain/completeness'
import { protocolPoint } from '../domain/protocol'
import { medicationProgress } from '../domain/medication'
import { knownUsers } from '../domain/users'
import { LOCATIONS } from '../domain/catalogs'
import { diaTratamiento } from '../domain/diaTratamiento'
import { FRANJAS, franjaDeHora, tareasDelDia, type Tarea } from '../domain/momentos'
import { useSaludHoy } from '../components/Salud'
import { APARTADOS } from '../components/Apartados'

/** Pantalla de entrada (0.29.0). Sustituye a Inicio: primero la salud, luego lo que toca apuntar
 *  ahora (por momento del día), el progreso del registro en tono neutro y lo de más tarde. */
export default function Hoy() {
  const { today, patient, todayLog, traffic, ctx } = useSaludHoy()
  const cycles = useRows('cycles')
  const todos = useRows('todos', (t) => t.status === 'pendiente')
  const events = useRows('calendar_events', (e) => e.status === 'previsto')
  const allProducts = useRows('products')
  const intakes = useRows('intakes')
  const me = backend.currentUserId()
  const nameOf = (id: string) => knownUsers().find((u) => u.id === id)?.name ?? 'alguien'

  const reg = dayCompleteness(todayLog, today, medicationProgress(allProducts, intakes, cycles, today))
  const tareas = tareasDelDia(reg, todayLog, today, allProducts, intakes, cycles)
  const ahora = franjaDeHora(new Date().getHours())
  const iAhora = FRANJAS.findIndex((f) => f.key === ahora)
  const orden = (t: Tarea) => FRANJAS.findIndex((f) => f.key === t.franja)
  const tocan = tareas.filter((t) => !t.done && orden(t) <= iAhora)
  const hechas = tareas.filter((t) => t.done)
  const luego = FRANJAS.slice(iAhora + 1).map((f) => ({ f, lista: tareas.filter((t) => t.franja === f.key && !t.done) })).filter((x) => x.lista.length)
  const pct = Math.round((reg.done / reg.total) * 100)

  const cortico = corticoidAlert(cycles, today)
  const pp = protocolPoint(patient?.protocol_start, today)
  const lugar = LOCATIONS.find((l) => l.value === todayLog?.location)
  const estado = ctx.nadir ? 'Nadir (D7-14)' : 'En ciclo'
  // Productos con la regla «N días tras la quimio» que se pueden empezar hoy o en los 2 días siguientes al desbloqueo.
  const products = allProducts.filter((p) => !!p.after_chemo_days && (!p.end_date || p.end_date > today))
  const unlocked = products
    .map((p) => ({ p, g: afterChemoGate(p, cycles, today) }))
    .filter((x) => x.g && !x.g.waiting && !!x.g.from && today <= addDays(x.g.from, 2))

  const hoyEventos = events.filter((e) => e.start_at.slice(0, 10) === today).sort((a, b) => a.start_at.localeCompare(b.start_at))
  const masAdelante = events.filter((e) => e.start_at.slice(0, 10) > today).length
  // Solo lo que toca hacer hoy (o lo que se quedó atrás). El resto está en Pendientes.
  const todoDate = (t: { do_date?: string | null; due_date?: string | null }) => t.do_date ?? t.due_date ?? null
  const forMe = (t: { assignees: string[] }) => t.assignees.includes(me) || t.assignees.length === 0
  const late = todos.filter((t) => { const d = todoDate(t); return !!d && d < today }).sort((a, b) => (todoDate(a) ?? '').localeCompare(todoDate(b) ?? ''))
  const hoy = todos.filter((t) => todoDate(t) === today)
  const todayList = [...late, ...hoy]
  const resto = todos.length - todayList.length
  const dressingDue = patient?.catheter_last_dressing && patient.catheter_dressing_days
    ? addDays(patient.catheter_last_dressing, patient.catheter_dressing_days) : null
  const dia = new Date(today + 'T12:00')
  const fechaLarga = `${dia.toLocaleDateString('es-ES', { weekday: 'long' })} ${dia.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`

  return (
    <div className="hoy">
      <h1 className="hoy-titulo">Hoy, {fechaLarga}</h1>
      <div className="muted small">
        <strong style={{ color: 'var(--text)' }}>{patient?.name}</strong>{' · '}
        {ctx.cycle
          ? `${diaTratamiento(patient?.protocol_start, cycles, today)?.texto ?? `Ciclo ${ctx.cycle.number}`} · ${estado}`
          : <>Sin ciclos registrados · <Link to="/ciclos">añadir el primer ciclo</Link></>}
      </div>
      {pp && <div className="muted small">{pp.plan ? `Esta semana del protocolo toca ${pp.plan}` : 'Semana de descanso del protocolo'}</div>}
      {lugar && <div className="small" style={{ marginTop: '.2rem' }}>{lugar.emoji} {lugar.short}</div>}

      <div className={'traffic inline hoy-salud ' + traffic.level}>
        <h2>
          {traffic.level === 'rojo' && 'Salud en rojo — llama a oncología o acude a urgencias'}
          {traffic.level === 'amarillo' && 'Salud: vigilar y consultar hoy'}
          {traffic.level === 'verde' && (todayLog ? 'Salud: sin señales de alarma' : 'Salud: sin señales de alarma registradas hoy')}
        </h2>
        {todayLog && traffic.reasons.length > 0 && <ul>{traffic.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {/* El teléfono y el aviso del antitérmico van en la banda roja fija de arriba. */}
      </div>

      <section className="card hoy-ahora">
        <div className="hoy-ahora-head">
          <h2>Ahora toca</h2>
          <span className="hoy-franja">{FRANJAS[iAhora].label}</span>
        </div>
        {hechas.length > 0 && (
          <div className="hoy-hecho">✓ Ya apuntado: {hechas.length} {hechas.length === 1 ? 'cosa' : 'cosas'}</div>
        )}
        {tocan.length === 0 && <div className="hoy-vacio">Todo apuntado por ahora.</div>}
        {tocan.map((t) => <FilaTarea key={t.key} t={t} atrasada={orden(t) < iAhora} />)}
      </section>

      <section className="card tight hoy-registro" aria-label="Registro de hoy">
        <div className="row between">
          <strong>Registro de hoy</strong>
          <strong className="hoy-registro-n">{reg.done} de {reg.total}</strong>
        </div>
        <div className="hoy-barra" role="img" aria-label={`${reg.done} de ${reg.total} apartados`}><div style={{ width: `${pct}%` }} /></div>
      </section>

      {luego.length > 0 && <h3 className="hoy-rotulo">Más tarde</h3>}
      {luego.map(({ f, lista }) => (
        <details key={f.key} className="section hoy-luego">
          <summary><span><strong>{f.label}</strong><span className="muted small"> · {lista.map((t) => t.label.toLowerCase()).join(', ')}</span></span></summary>
          <div className="hoy-luego-lista">{lista.map((t) => <FilaTarea key={t.key} t={t} />)}</div>
        </details>
      ))}

      <h3 className="hoy-rotulo">Ver por apartado</h3>
      <div className="grid3 hoy-apartados">
        {APARTADOS.map((a) => <Link key={a.to} className="btn secondary" to={a.to}>{a.ico} {a.label}</Link>)}
      </div>

      {cortico && (
        <div className="notice" style={{ marginTop: '.8rem' }}>
          <strong>Corticoide intravenoso en el ciclo {cortico.number}</strong>{cortico.corticoid_detail ? ` (${cortico.corticoid_detail})` : ''}: puede subir la glucosa y alterar el sueño estos días. Vigilar apetito, sed, pipí abundante y despertares; anotar en <Link to="/nutricion">Nutrición</Link> y <Link to="/biohacking">Biohacking</Link>.
        </div>
      )}
      {unlocked.map(({ p, g }) => (
        <div className="notice" key={p.id} style={{ marginTop: '.8rem' }}>
          <strong>{p.name}</strong>: desde el {fmtDate(g!.from!)} ({p.after_chemo_days} días tras {g!.basis === 'fin_ciclo' ? 'el cisplatino + adriamicina, al terminar el ciclo' : 'la última quimio'}) se puede dar{p.condition ? <> <strong>si {p.condition}</strong></> : ''}. Pauta en <Link to="/medicacion">Medicación</Link>.
        </div>
      ))}
      {dressingDue && dressingDue <= today && (
        <div className="notice" style={{ marginTop: '.8rem' }}>Cura del catéter: tocaba el {fmtDate(dressingDue)} (última {fmtDate(patient!.catheter_last_dressing)}). Actualízala en <Link to="/ajustes">Ajustes</Link> cuando se haga.</div>
      )}

      <h3 className="hoy-rotulo">☑️ Tareas de hoy</h3>
      <div className="card tight">
        {todayList.length === 0 && <div className="muted">Nada que hacer hoy.</div>}
        {todayList.map((t) => (
          <TodoLine
            key={t.id}
            id={t.id}
            title={t.title}
            onDone={() => save('todos', { ...t, status: 'hecho', done_at: new Date().toISOString(), done_by: me })}
            meta={`${forMe(t) ? (t.assignees.length ? 'asignado a ti' : 'sin asignar') : `para ${t.assignees.map(nameOf).join(', ')}`}${todoDate(t)! < today ? ` · atrasado, era para el ${fmtDate(todoDate(t))}` : ''}${t.due_date && t.do_date && t.due_date !== t.do_date ? ` · límite ${fmtDate(t.due_date)}` : ''}`}
            priority={t.priority}
            late={todoDate(t)! < today}
          />
        ))}
        {resto > 0 && (
          <div className="muted small" style={{ paddingTop: '.4rem' }}>
            <Link to="/pendientes">Ver todos los pendientes ({todos.length})</Link>
          </div>
        )}
      </div>
      <h3 className="hoy-rotulo">📅 Citas de hoy</h3>
      <div className="card tight">
        {hoyEventos.length === 0 && <div className="muted">Nada en el calendario para hoy. <Link to="/calendario">Añadir</Link></div>}
        {hoyEventos.map((e) => (
          <div className="item" key={e.id}>
            <div className="main">
              <div>{e.title}</div>
              <div className="meta">{e.all_day ? 'todo el día' : fmtWall(e.start_at).replace(/^.*?, /, '')}{e.place ? ` · ${e.place}` : ''}{e.companion ? ` · acompaña ${e.companion}` : ''}</div>
            </div>
          </div>
        ))}
        {masAdelante > 0 && (
          <div className="muted small" style={{ paddingTop: '.4rem' }}>
            <Link to="/calendario">{masAdelante} cita{masAdelante > 1 ? 's' : ''} en los próximos días →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Una cosa por apuntar: toda la fila lleva a la pantalla donde se apunta. */
function FilaTarea({ t, atrasada }: { t: Tarea; atrasada?: boolean }) {
  return (
    <Link to={t.to} className="hoy-fila">
      <span className="hoy-fila-ico" aria-hidden="true">{t.ico}</span>
      <span className="hoy-fila-txt">
        <strong>{t.label}</strong>
        {(t.detalle || atrasada) && <span className="muted small">{atrasada ? 'De antes · ' : ''}{t.detalle ?? 'Sin apuntar'}</span>}
      </span>
      <span className="hoy-fila-ir" aria-hidden="true">›</span>
    </Link>
  )
}

function TodoLine({ id, title, meta, priority, late, onDone }: { id: string; title: string; meta: string; priority: string; late?: boolean; onDone: () => void }) {
  return (
    <div className="item">
      <input
        type="checkbox"
        checked={false}
        title="Marcar como hecha"
        onChange={onDone}
        style={{ marginTop: '.15rem' }}
      />
      <div className="main">
        <div>
          {priority === 'urgente' && <span className="tag rojo">urgente</span>}
          {priority === 'importante' && <span className="tag ambar">importante</span>}
          {late && <span className="tag rojo">atrasado</span>}
          <Link to={`/pendientes/${id}`} style={{ color: 'inherit' }}>{title}</Link>
        </div>
        <div className="meta">{meta}</div>
      </div>
    </div>
  )
}
