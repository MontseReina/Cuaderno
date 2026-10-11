import { Link } from 'react-router-dom'
import { backend, useRows, save } from '../store'
import { addDays, fmtDate, fmtWall } from '../domain/dates'
import { afterChemoGate, corticoidAlert } from '../domain/cycle'
import { protocolPoint } from '../domain/protocol'
import { knownUsers } from '../domain/users'
import { LOCATIONS } from '../domain/catalogs'
import { diaTratamiento } from '../domain/diaTratamiento'
import { useSaludHoy } from '../components/Salud'
import { Marca, useResumenDia } from '../components/Apartados'
import type { EstadoApartado } from '../domain/apartados'

/** Pantalla de entrada. Primero la salud y después una sola lista con lo que queda por rellenar,
 *  apartado por apartado (0.30.0: sin franjas de mañana, tarde y noche). Lo completo baja a «Hecho». */
export default function Hoy() {
  const { today, patient, todayLog, traffic, ctx } = useSaludHoy()
  const cycles = useRows('cycles')
  const todos = useRows('todos', (t) => t.status === 'pendiente')
  const events = useRows('calendar_events', (e) => e.status === 'previsto')
  const allProducts = useRows('products')
  const me = backend.currentUserId()
  const nameOf = (id: string) => knownUsers().find((u) => u.id === id)?.name ?? 'alguien'

  const { comp: reg, apartados } = useResumenDia(today)
  const quedan = apartados.filter((a) => !a.completo)
  const hechos = apartados.filter((a) => a.completo)
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

      <section className="card hoy-ahora" aria-label="Lo que queda por rellenar hoy">
        <div className="hoy-ahora-head">
          <h2>{quedan.length ? 'Te queda por rellenar' : 'Registro de hoy'}</h2>
          <strong className="hoy-registro-n">{reg.done} de {reg.total}</strong>
        </div>
        <div className="hoy-barra" role="img" aria-label={`${reg.done} de ${reg.total} apartados`}><div style={{ width: `${pct}%` }} /></div>
        {quedan.length === 0 && <div className="hoy-vacio">✓ Todo apuntado por hoy.</div>}
        {quedan.map((a) => <FilaApartado key={a.to} a={a} />)}
      </section>

      {hechos.length > 0 && (
        <section className="card hoy-hechos" aria-label="Apartados completos">
          <div className="hoy-hechos-head">Hecho</div>
          {hechos.map((a) => <FilaApartado key={a.to} a={a} />)}
        </section>
      )}

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

/** Un apartado del registro: qué le falta (o que está completo). Toda la fila lleva a su pantalla. */
function FilaApartado({ a }: { a: EstadoApartado }) {
  return (
    <Link to={a.to} className={'hoy-fila' + (a.completo ? ' hecha' : '')}>
      <span className="hoy-fila-ico" aria-hidden="true">{a.ico}</span>
      <span className="hoy-fila-txt">
        <strong>{a.nombre}</strong>
        {!a.completo && <span className="muted small">{a.falta}</span>}
      </span>
      <Marca a={a} />
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
