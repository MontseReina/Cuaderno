import { useState } from 'react'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { CalendarEvent, EventStatus, EventType } from '../store/types'
import { EVENT_TYPES, PROFESSIONALS } from '../domain/catalogs'
import { addDays, fmtDate, fmtWall, nowLocalInput, toLocalInput, todayStr } from '../domain/dates'
import { Check, Field, Segmented } from '../components/ui'
import { calendarioTratamiento, protocolPoint } from '../domain/protocol'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Días del mes (YYYY-MM) con huecos al principio para empezar en lunes. */
function diasDelMes(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1, 12)
  const pad = (first.getDay() + 6) % 7
  const n = new Date(y, m, 0, 12).getDate()
  const days: string[] = Array.from({ length: pad }, () => '')
  for (let d = 1; d <= n; d++) days.push(`${ym}-${String(d).padStart(2, '0')}`)
  return days
}
function otroMes(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1, 12)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Calendario() {
  const events = useRows('calendar_events').sort((a, b) => a.start_at.localeCompare(b.start_at))
  const cycles = useRows('cycles')
  const patient = useRows('patients')[0]
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)
  // Orden y vista por defecto pedidos el 28/09: primero «Este mes» (abierto siempre), luego Próximos y Pasados.
  const [view, setView] = useState<'proximos' | 'mes' | 'pasados'>('mes')
  const today = todayStr()
  const [mes, setMes] = useState(today.slice(0, 7))
  const [diaSel, setDiaSel] = useState<string | null>(null)

  if (editing) return <EventForm initial={editing} onClose={() => setEditing(null)} />

  const upcoming = events.filter((e) => e.start_at.slice(0, 10) >= today && e.status !== 'cancelado')
  const past = events.filter((e) => e.start_at.slice(0, 10) < today).reverse()
  const label = (t: string) => EVENT_TYPES.find((x) => x.key === t)?.label ?? t
  const start = patient?.protocol_start ?? null
  const trat = calendarioTratamiento(start, cycles)
  const pp = (d: string) => protocolPoint(start, d)
  const dias = diasDelMes(mes)
  const [y, m] = mes.split('-').map(Number)
  const evDe = (d: string) => events.filter((e) => e.start_at.slice(0, 10) === d && e.status !== 'cancelado')
  const nombreDia = (d: string) => { const f = new Date(d + 'T12:00:00'); return `${DIAS_SEMANA[f.getDay()]} ${f.getDate()}` }
  const lineaTrat = (d: string) => {
    const t = trat.get(d)
    const p = pp(d)
    return [p ? `Sem ${p.week} · Día ${p.day}` : null, t ? t.largo : null].filter(Boolean).join(' · ')
  }
  const delMes = dias.filter((d) => d && (trat.has(d) || evDe(d).length))

  const tarjetaEvento = (e: CalendarEvent) => (
    <div className="card tight" key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer', marginTop: '.5rem', opacity: e.status === 'realizado' ? 0.7 : 1 }}>
      <div className="row between">
        <div>
          <span className="tag gray">{label(e.type)}</span>
          <strong>{e.title}</strong>
        </div>
        {e.status !== 'previsto' && <span className="tag">{e.status}</span>}
      </div>
      <div className="muted small">
        {e.all_day ? fmtDate(e.start_at) : fmtWall(e.start_at)}{e.place ? ` · ${e.place}` : ''}{e.companion ? ` · acompaña ${e.companion}` : ''}{e.professional ? ` · ${e.professional}` : ''}
      </div>
      {e.expected_result_date && <div className="small">Resultado esperado: {fmtDate(e.expected_result_date)}</div>}
    </div>
  )

  return (
    <div>
      <div className="row between">
        <h1>Calendario</h1>
        <button className="btn sm" onClick={() => setEditing({ type: 'consulta', start_at: nowLocalInput(), all_day: false, status: 'previsto' })}>+ Evento</button>
      </div>
      <Segmented options={[{ value: 'mes', label: 'Este mes' }, { value: 'proximos', label: 'Próximos' }, { value: 'pasados', label: 'Pasados' }]} value={view} onChange={(v) => setView(v ?? 'mes')} />

      {view === 'mes' && (
        <div className="card cal" style={{ marginTop: '.6rem' }}>
          <div className="cal-head">
            <button type="button" className="btn sm secondary" aria-label="Mes anterior" onClick={() => { setMes(otroMes(mes, -1)); setDiaSel(null) }}>‹</button>
            <div className="cal-mes">
              <strong>{MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} {y}</strong>
              {mes !== today.slice(0, 7) && <button type="button" className="linkbtn small" onClick={() => { setMes(today.slice(0, 7)); setDiaSel(null) }}>volver a hoy</button>}
            </div>
            <button type="button" className="btn sm secondary" aria-label="Mes siguiente" onClick={() => { setMes(otroMes(mes, 1)); setDiaSel(null) }}>›</button>
          </div>
          <div className="cal-grid">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {dias.map((d, i) => {
              if (!d) return <div key={i} />
              const t = trat.get(d)
              const p = pp(d)
              const evs = evDe(d)
              return (
                <button type="button" key={d} className={'cal-dia' + (d === today ? ' hoy' : '') + (d === diaSel ? ' sel' : '')} onClick={() => setDiaSel(d === diaSel ? null : d)}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  {p && <span className="cal-sd">S{p.week}·D{p.day}</span>}
                  {t && <span className={'cal-trat ' + t.tipo}>{t.corto}</span>}
                  {evs.slice(0, 2).map((e) => <span key={e.id} className="cal-ev">• {e.title}</span>)}
                  {evs.length > 2 && <span className="cal-ev muted">+{evs.length - 2}</span>}
                </button>
              )
            })}
          </div>
          <div className="cal-leyenda small muted">
            <span><i className="cal-trat mtx">MTX</i> Metotrexato</span>
            <span><i className="cal-trat cddp">CDDP</i> Cisplatino</span>
            <span><i className="cal-trat adm">ADM</i> Adriamicina</span>
            <span><i className="cal-trat cirugia">Cirugía</i> posible</span>
            <span>S = semana · D = día del tratamiento</span>
          </div>

          {diaSel && (
            <div className="cal-detalle">
              <strong>{nombreDia(diaSel)} de {MESES[Number(diaSel.slice(5, 7)) - 1]}</strong>
              {lineaTrat(diaSel) && <div className="small">{lineaTrat(diaSel)}{trat.get(diaSel)?.registrada ? ' · registrado en Tratamiento' : ''}</div>}
              {evDe(diaSel).map((e) => tarjetaEvento(e))}
              {!lineaTrat(diaSel) && !evDe(diaSel).length && <div className="muted small">Nada apuntado este día.</div>}
              <button type="button" className="btn sm secondary" style={{ marginTop: '.5rem' }} onClick={() => setEditing({ type: 'consulta', start_at: diaSel + 'T09:00', all_day: false, status: 'previsto' })}>+ Evento este día</button>
            </div>
          )}

          {delMes.length > 0 && (
            <div className="cal-lista">
              <h3>Este mes</h3>
              {delMes.map((d) => (
                <div key={d} className="cal-fila" onClick={() => setDiaSel(d)}>
                  <span className="cal-fecha">{nombreDia(d)}</span>
                  <span>
                    {trat.get(d) && <strong>{lineaTrat(d)}</strong>}
                    {!trat.get(d) && pp(d) && <span className="muted">Sem {pp(d)!.week} · Día {pp(d)!.day}</span>}
                    {evDe(d).map((e) => <div key={e.id} className="small">{label(e.type)}: {e.title}{e.all_day ? '' : ` · ${e.start_at.slice(11, 16)}`}</div>)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(view === 'proximos' ? upcoming : view === 'pasados' ? past : []).map((e) => tarjetaEvento(e))}
      {view === 'proximos' && upcoming.length === 0 && <div className="empty">Nada previsto.</div>}
    </div>
  )
}

function EventForm({ initial, onClose }: { initial: Partial<CalendarEvent>; onClose: () => void }) {
  const [e, setE] = useState<Partial<CalendarEvent>>(initial)
  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) => setE((x) => ({ ...x, [k]: v }))
  const needsResult = e.type === 'prueba' || e.type === 'extraccion'
  const parent = e.parent_id ? backend.all('calendar_events').find((x) => x.id === e.parent_id) : undefined
  const questions = e.professional ? backend.all('questions').filter((q) => q.professional === e.professional && q.status === 'pendiente') : []
  return (
    <div>
      <div className="row between"><h1>{e.id ? 'Evento' : 'Nuevo evento'}</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        {parent && <div className="notice">Resultado esperado de: <strong>{parent.title}</strong> ({fmtDate(parent.start_at)}). Se cierra al registrar el resultado.</div>}
        <Field label="Tipo"><Segmented options={EVENT_TYPES.map((t) => ({ value: t.key as EventType, label: t.label }))} value={e.type} onChange={(v) => set('type', v ?? 'otro')} /></Field>
        <Field label="Título"><input type="text" value={e.title ?? ''} onChange={(ev) => set('title', ev.target.value)} /></Field>
        <Check checked={!!e.all_day} onChange={(v) => set('all_day', v)}>Todo el día</Check>
        <div className="grid2">
          <Field label={e.all_day ? 'Fecha' : 'Fecha y hora'}>
            {e.all_day ? <input type="date" value={(e.start_at ?? '').slice(0, 10)} onChange={(ev) => set('start_at', ev.target.value + 'T09:00')} /> : <input type="datetime-local" value={toLocalInput(e.start_at)} onChange={(ev) => set('start_at', ev.target.value)} />}
          </Field>
          <Field label="Lugar"><input type="text" value={e.place ?? ''} onChange={(ev) => set('place', ev.target.value)} /></Field>
          <Field label="Quién acompaña"><input type="text" value={e.companion ?? ''} onChange={(ev) => set('companion', ev.target.value)} /></Field>
          <Field label="Profesional del equipo">
            <select value={e.professional ?? ''} onChange={(ev) => set('professional', ev.target.value || undefined)}>
              <option value="">—</option>
              {PROFESSIONALS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        {needsResult && (
          <Field label="Resultado estimado el" hint="Se crea automáticamente un evento 'esperar resultado' ese día">
            <input type="date" value={e.expected_result_date ?? ''} onChange={(ev) => set('expected_result_date', ev.target.value || null)} />
          </Field>
        )}
        <Field label="Estado"><Segmented options={[{ value: 'previsto', label: 'Previsto' }, { value: 'realizado', label: 'Realizado' }, { value: 'pospuesto', label: 'Pospuesto' }, { value: 'cancelado', label: 'Cancelado' }] as { value: EventStatus; label: string }[]} value={e.status} onChange={(v) => set('status', v ?? 'previsto')} /></Field>
        <Field label="Notas"><textarea value={e.notes ?? ''} onChange={(ev) => set('notes', ev.target.value)} /></Field>
        {questions.length > 0 && (
          <div className="notice">
            <strong>Preguntas pendientes para {e.professional}:</strong>
            <ul style={{ margin: '.3rem 0 0 1rem', padding: 0 }}>{questions.map((q) => <li key={q.id} className="small">{q.question}</li>)}</ul>
          </div>
        )}
      </div>
      <div className="row">
        <button className="btn" disabled={!e.title?.trim() || !e.start_at} onClick={async () => {
          const saved = await save('calendar_events', { ...e, patient_id: currentPatientId() } as CalendarEvent)
          if (needsResult && e.expected_result_date && !backend.all('calendar_events').some((x) => x.parent_id === saved.id)) {
            await save('calendar_events', { patient_id: currentPatientId(), type: 'resultado', title: `Esperar resultado: ${e.title}`, start_at: e.expected_result_date + 'T09:00', all_day: true, status: 'previsto', parent_id: saved.id })
            await save('todos', { patient_id: currentPatientId(), title: `Recoger / revisar resultado: ${e.title}`, assignees: [], priority: 'normal', origin: 'calendario', status: 'pendiente', do_date: e.expected_result_date, due_date: e.expected_result_date })
          }
          if (e.type === 'cura_cateter' && e.status === 'realizado' && !e.id) {
            /* nada: la siguiente cura se programa a mano */
          }
          onClose()
        }}>Guardar</button>
        {e.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar este evento?')) { await remove('calendar_events', e.id!); onClose() } }}>Borrar</button>}
      </div>
      {e.id && e.status === 'previsto' && (
        <p className="muted small" style={{ marginTop: '.6rem' }}>
          Posponer una semana: <button className="btn sm ghost" onClick={() => set('start_at', addDays(e.start_at!.slice(0, 10), 7) + e.start_at!.slice(10))}>+7 días</button>
        </p>
      )}
    </div>
  )
}
