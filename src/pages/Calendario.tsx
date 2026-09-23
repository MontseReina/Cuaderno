import { useState } from 'react'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { CalendarEvent, EventStatus, EventType } from '../store/types'
import { EVENT_TYPES, PROFESSIONALS } from '../domain/catalogs'
import { addDays, fmtDate, fmtWall, nowLocalInput, toLocalInput, todayStr } from '../domain/dates'
import { Check, Field, Segmented } from '../components/ui'

export default function Calendario() {
  const events = useRows('calendar_events').sort((a, b) => a.start_at.localeCompare(b.start_at))
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)
  const [view, setView] = useState<'proximos' | 'mes' | 'pasados'>('proximos')
  const today = todayStr()

  if (editing) return <EventForm initial={editing} onClose={() => setEditing(null)} />

  const upcoming = events.filter((e) => e.start_at.slice(0, 10) >= today && e.status !== 'cancelado')
  const past = events.filter((e) => e.start_at.slice(0, 10) < today).reverse()
  const label = (t: string) => EVENT_TYPES.find((x) => x.key === t)?.label ?? t

  const monthDays = (() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(1)
    const first = new Date(d)
    const pad = (first.getDay() + 6) % 7
    const days: string[] = []
    for (let i = 0; i < pad; i++) days.push('')
    while (d.getMonth() === first.getMonth()) {
      days.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return days
  })()

  return (
    <div>
      <div className="row between">
        <h1>Calendario</h1>
        <button className="btn sm" onClick={() => setEditing({ type: 'consulta', start_at: nowLocalInput(), all_day: false, status: 'previsto' })}>+ Evento</button>
      </div>
      <Segmented options={[{ value: 'proximos', label: 'Próximos' }, { value: 'mes', label: 'Este mes' }, { value: 'pasados', label: 'Pasados' }]} value={view} onChange={(v) => setView(v ?? 'proximos')} />

      {view === 'mes' && (
        <div className="card" style={{ marginTop: '.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', fontSize: '.8rem' }}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="muted" style={{ textAlign: 'center' }}>{d}</div>)}
            {monthDays.map((d, i) => {
              const evs = d ? events.filter((e) => e.start_at.slice(0, 10) === d && e.status !== 'cancelado') : []
              return (
                <div key={i} style={{ minHeight: 52, border: '1px solid var(--line)', borderRadius: 6, padding: 2, background: d === today ? 'var(--primary-soft)' : '#fff' }}>
                  {d && <div className="muted">{Number(d.slice(8))}</div>}
                  {evs.slice(0, 2).map((e) => <div key={e.id} onClick={() => setEditing(e)} style={{ fontSize: '.65rem', lineHeight: 1.1, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>• {e.title}</div>)}
                  {evs.length > 2 && <div className="muted" style={{ fontSize: '.65rem' }}>+{evs.length - 2}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(view === 'proximos' ? upcoming : view === 'pasados' ? past : []).map((e) => (
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
      ))}
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
