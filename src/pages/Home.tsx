import { Link } from 'react-router-dom'
import { backend, useRows, save, currentPatientId } from '../store'
import { addDays, fmtDate, fmtDateTime, todayStr } from '../domain/dates'
import { corticoidAlert, cycleContext, dailyTraffic, symptomsForToday } from '../domain/cycle'
import { dayNutrition, weekMode } from '../domain/nutrition'
import { MODE_LABELS } from '../domain/catalogs'
import { DRUG_LABELS } from '../domain/catalogs'
import { useEffect } from 'react'

export default function Home() {
  const today = todayStr()
  const patient = backend.all('patients')[0]
  const cycles = useRows('cycles')
  const diagnoses = useRows('diagnoses')
  const logs = useRows('daily_logs')
  const todos = useRows('todos', (t) => t.status === 'pendiente')
  const events = useRows('calendar_events', (e) => e.status === 'previsto')
  const me = backend.currentUserId()

  const ctx = cycleContext(cycles, today)
  const defs = symptomsForToday(ctx, diagnoses)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const prev = [1, 2, 3].map((n) => byDate.get(addDays(today, -n))).filter((l): l is NonNullable<typeof l> => !!l)
  const todayLog = byDate.get(today)
  const traffic = dailyTraffic(todayLog, prev, ctx, defs)
  const cortico = corticoidAlert(cycles, today)
  const mode = weekMode(todayLog, ctx)
  const nut = dayNutrition(todayLog, mode, { cisplatin: !!ctx.cycle && ctx.inCycle && ctx.cycle.drugs.includes('CDDP') })

  // Si el semáforo está en rojo, crear un pendiente (una vez por día).
  useEffect(() => {
    if (traffic.level !== 'rojo') return
    const exists = backend.all('todos').some((t) => t.origin === 'semaforo' && t.created_at.slice(0, 10) === today && t.status === 'pendiente')
    if (!exists) {
      save('todos', {
        patient_id: currentPatientId(),
        title: 'Semáforo ROJO hoy: llamar a oncología / acudir a urgencias',
        pillar: 'Registro diario', assignees: [], priority: 'urgente', origin: 'semaforo', status: 'pendiente',
        notes: traffic.reasons.join('; '),
      })
    }
  }, [traffic.level, today, traffic.reasons])

  const strip = Array.from({ length: 21 }, (_, i) => {
    const d = addDays(today, i - 20)
    const l = byDate.get(d)
    const c = cycleContext(cycles, d)
    const p = [1, 2].map((n) => byDate.get(addDays(d, -n))).filter((x): x is NonNullable<typeof x> => !!x)
    return { d, level: l ? dailyTraffic(l, p, c, symptomsForToday(c, diagnoses)).level : '' }
  })
  const upcoming = events
    .filter((e) => new Date(e.start_at).getTime() > Date.now() - 3600000)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 5)
  const mine = todos.filter((t) => t.assignees.includes(me))
  const unassigned = todos.filter((t) => t.assignees.length === 0)
  const phone = patient?.phone_oncology
  let streak = 0
  for (let i = byDate.has(today) ? 0 : 1; byDate.has(addDays(today, -i)); i++) streak++
  const dressingDue = patient?.catheter_last_dressing && patient.catheter_dressing_days
    ? addDays(patient.catheter_last_dressing, patient.catheter_dressing_days) : null

  return (
    <div>
      <div className={'traffic ' + traffic.level}>
        <h2>
          {traffic.level === 'rojo' && 'ROJO — llama a oncología o acude a urgencias'}
          {traffic.level === 'amarillo' && 'AMARILLO — vigilar y consultar hoy'}
          {traffic.level === 'verde' && (todayLog ? 'VERDE — sin señales de alarma' : 'Hoy aún sin registro')}
        </h2>
        {traffic.reasons.length > 0 && (
          <ul>
            {traffic.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {traffic.level === 'rojo' && phone && (
          <p>
            <a href={`tel:${phone}`} style={{ color: '#fff', fontWeight: 700 }}>📞 {phone}</a> — no dar antitérmico antes de llamar
          </p>
        )}
        <p className="small" style={{ marginTop: '.5rem' }}>
          <Link to={`/diario/${today}`} style={{ color: 'inherit', fontWeight: 700 }}>
            {todayLog ? 'Completar el registro de hoy →' : 'Hacer el registro de hoy →'}
          </Link>
        </p>
      </div>

      <div className="card tight">
        <div className="row between">
          <div>
            <strong>{patient?.name}</strong>
            <div className="muted small">
              {ctx.cycle
                ? `Ciclo ${ctx.cycle.number} · ${ctx.cycle.drugs.map((d) => DRUG_LABELS[d] ?? d).join(' + ')} · D${ctx.day} · ${
                    ctx.inCycle ? 'en ciclo' : ctx.nadir ? 'valle (D7-14): máxima precaución' : 'fuera de ciclo'
                  }`
                : 'Sin ciclos registrados · '}
              {!ctx.cycle && <Link to="/ciclos">añadir el primer ciclo</Link>}
            </div>
          </div>
          <Link className="btn sm secondary" to="/ciclos">Ciclos</Link>
        </div>
        <div style={{ marginTop: '.6rem' }}>
          <div className="strip">
            {strip.map((s) => (
              <Link key={s.d} to={`/diario/${s.d}`} style={{ flex: 1, display: 'contents' }}>
                <span className={s.level} title={fmtDate(s.d)} />
              </Link>
            ))}
          </div>
          <div className="muted small">Últimos 21 días{streak > 0 && ` · racha: ${streak} día${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''} registrando`}</div>
        </div>
      </div>
      {cortico && (
        <div className="notice">
          <strong>Corticoide intravenoso en el ciclo {cortico.number}</strong>{cortico.corticoid_detail ? ` (${cortico.corticoid_detail})` : ''}: puede subir la glucosa y alterar el sueño estos días. Vigilar apetito, sed, pipí abundante y despertares; anotar en <Link to="/nutricion">Nutrición</Link> y <Link to="/biohacking">Biohacking</Link>.
        </div>
      )}
      {todayLog && (
        <div className="card tight">
          <div className="row between">
            <div><span className={'dot ' + nut.level} /><strong>Alimentación de hoy</strong> <span className="muted small">· {MODE_LABELS[mode]}</span></div>
            <Link className="btn sm secondary" to="/nutricion">Nutrición</Link>
          </div>
          <div className="muted small">{nut.meals}/{nut.target} comidas{nut.fatTarget ? ` · ${nut.fatSnacks}/${nut.fatTarget} snacks de grasa` : ''}{nut.fluids != null ? ` · ${nut.fluids} ml` : ''}{nut.reasons.length ? ` · ${nut.reasons.join(', ')}` : ' · objetivos cumplidos'}</div>
        </div>
      )}
      {dressingDue && dressingDue <= today && (
        <div className="notice">Cura del catéter: tocaba el {fmtDate(dressingDue)} (última {fmtDate(patient!.catheter_last_dressing)}). Actualízala en <Link to="/ajustes">Ajustes</Link> cuando se haga.</div>
      )}

      <h2>Hoy y próximos días</h2>
      <div className="card tight">
        {mine.length === 0 && unassigned.length === 0 && todos.length === 0 && <div className="muted">No hay pendientes.</div>}
        {mine.map((t) => (
          <TodoLine key={t.id} title={t.title} meta="asignado a ti" priority={t.priority} />
        ))}
        {unassigned.map((t) => (
          <TodoLine key={t.id} title={t.title} meta="sin asignar" priority={t.priority} />
        ))}
        {todos.length > mine.length + unassigned.length && (
          <div className="muted small" style={{ paddingTop: '.4rem' }}>
            <Link to="/pendientes">Ver todos los pendientes ({todos.length})</Link>
          </div>
        )}
      </div>
      <div className="card tight">
        {upcoming.length === 0 && <div className="muted">Nada en el calendario próximamente. <Link to="/calendario">Añadir</Link></div>}
        {upcoming.map((e) => (
          <div className="item" key={e.id}>
            <div className="main">
              <div>{e.title}</div>
              <div className="meta">{e.all_day ? fmtDate(e.start_at) : fmtDateTime(e.start_at)}{e.place ? ` · ${e.place}` : ''}{e.companion ? ` · acompaña ${e.companion}` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      <h2>Pilares</h2>
      <div className="grid3">
        <Link className="btn secondary" to="/diagnosticos">Diagnósticos</Link>
        <Link className="btn secondary" to="/ciclos">Tratamiento</Link>
        <Link className="btn secondary" to="/nutricion">Nutrición</Link>
        <Link className="btn secondary" to="/ejercicio">Ejercicio</Link>
        <Link className="btn secondary" to="/microbiota">Microbiota</Link>
        <Link className="btn secondary" to="/biohacking">Biohacking</Link>
        <Link className="btn secondary" to="/analiticas">Analíticas</Link>
        <Link className="btn secondary" to="/emocional">Emocional</Link>
        <Link className="btn secondary" to="/equipo">Preguntas</Link>
      </div>
    </div>
  )
}

function TodoLine({ title, meta, priority }: { title: string; meta: string; priority: string }) {
  return (
    <div className="item">
      <div className="main">
        <div>
          {priority === 'urgente' && <span className="tag rojo">urgente</span>}
          {priority === 'importante' && <span className="tag ambar">importante</span>}
          {title}
        </div>
        <div className="meta">{meta}</div>
      </div>
    </div>
  )
}
