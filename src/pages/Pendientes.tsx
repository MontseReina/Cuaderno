import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { Priority, Todo } from '../store/types'
import { PILLARS } from '../domain/catalogs'
import { fmtDate, fmtDateTime, todayStr } from '../domain/dates'
import { Field, Segmented } from '../components/ui'
import { knownUsers } from '../domain/users'

export default function Pendientes() {
  const todos = useRows('todos')
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Partial<Todo> | null>(null)
  // Si se llega desde la portada con /pendientes/<id>, abrir ese pendiente.
  useEffect(() => {
    if (!id) return
    const t = todos.find((x) => x.id === id)
    if (t) setEditing(t)
  }, [id, todos])
  const [showDone, setShowDone] = useState(false)
  const today = todayStr()
  const users = knownUsers()
  const me = backend.currentUserId()
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'alguien'

  const dateOf = (t: Todo) => t.do_date ?? t.due_date ?? null
  const pending = todos.filter((t) => t.status === 'pendiente').sort((a, b) => {
    const pr = { urgente: 0, importante: 1, normal: 2 }
    return (dateOf(a) ?? '9').localeCompare(dateOf(b) ?? '9') || pr[a.priority] - pr[b.priority]
  })
  const done = todos.filter((t) => t.status === 'hecho').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const closeForm = () => { setEditing(null); if (id) navigate('/pendientes', { replace: true }) }
  if (editing) return <TodoForm initial={editing} onClose={closeForm} />

  const complete = (t: Todo, v: boolean) =>
    save('todos', { ...t, status: v ? 'hecho' : 'pendiente', done_at: v ? new Date().toISOString() : null, done_by: v ? me : null })

  return (
    <div>
      <div className="row between">
        <h1>Pendientes y avisos</h1>
        <button className="btn sm" onClick={() => setEditing({ assignees: [], priority: 'normal', origin: 'manual', status: 'pendiente', do_date: today })}>+ Pendiente</button>
      </div>
      {pending.length === 0 && <div className="empty">Nada pendiente. 🎉</div>}
      {pending.map((t) => (
        <div className="card tight" key={t.id} style={{ marginBottom: '.4rem' }}>
          <label className="check" style={{ borderBottom: 'none' }}>
            <input type="checkbox" checked={false} onChange={() => complete(t, true)} />
            <span style={{ flex: 1 }} onClick={(e) => { e.preventDefault(); setEditing(t) }}>
              {t.priority === 'urgente' && <span className="tag rojo">urgente</span>}
              {t.priority === 'importante' && <span className="tag ambar">importante</span>}
              {t.origin !== 'manual' && <span className="tag gray">{t.origin}</span>}
              {t.title}
              <div className="meta">
                {t.assignees.length ? `Para: ${t.assignees.map(nameOf).join(', ')}` : 'Sin asignar'}
                {t.do_date && ` · ${t.do_date === today ? 'para hoy' : `para el ${fmtDate(t.do_date)}`}`}
                {t.due_date && ` · límite ${fmtDate(t.due_date)}`}
                {dateOf(t) && dateOf(t)! < today && <span className="tag rojo" style={{ marginLeft: '.3rem' }}>atrasado</span>}
                {t.pillar && ` · ${t.pillar}`}
              </div>
              {t.notes && <div className="small muted">{t.notes}</div>}
            </span>
          </label>
        </div>
      ))}
      <p className="muted small" style={{ marginTop: '1rem' }}>
        <button className="btn sm ghost" onClick={() => setShowDone(!showDone)}>{showDone ? 'Ocultar realizados' : `Ver realizados (${done.length})`}</button>
      </p>
      {showDone && done.map((t) => (
        <div className="card tight" key={t.id} style={{ marginBottom: '.4rem', opacity: 0.75 }}>
          <label className="check done" style={{ borderBottom: 'none' }}>
            <input type="checkbox" checked onChange={() => complete(t, false)} />
            <span>{t.title}<div className="meta">Hecho {fmtDateTime(t.done_at)} por {nameOf(t.done_by ?? '')}</div></span>
          </label>
        </div>
      ))}
    </div>
  )
}

function TodoForm({ initial, onClose }: { initial: Partial<Todo>; onClose: () => void }) {
  const [t, setT] = useState<Partial<Todo>>(initial)
  const users = knownUsers()
  const set = <K extends keyof Todo>(k: K, v: Todo[K]) => setT((x) => ({ ...x, [k]: v }))
  return (
    <div>
      <div className="row between"><h1>{t.id ? 'Pendiente' : 'Nuevo pendiente'}</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        <Field label="Qué hay que hacer"><input type="text" value={t.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Prioridad"><Segmented options={[{ value: 'normal', label: 'Normal' }, { value: 'importante', label: 'Importante' }, { value: 'urgente', label: 'Urgente' }] as { value: Priority; label: string }[]} value={t.priority} onChange={(v) => set('priority', v ?? 'normal')} /></Field>
        <Field label="Asignar a" hint="Sin selección = cualquiera">
          <div className="chips">
            {users.map((u) => (
              <button key={u.id} type="button" className={'chip ' + (t.assignees?.includes(u.id) ? 'on' : '')} onClick={() => set('assignees', t.assignees?.includes(u.id) ? t.assignees.filter((x) => x !== u.id) : [...(t.assignees ?? []), u.id])}>{u.name}</button>
            ))}
          </div>
        </Field>
        <div className="grid2">
          <Field label="Día en que se hace" hint="Es el día en el que aparece en «Hoy».">
            <input type="date" value={t.do_date ?? ''} onChange={(e) => set('do_date', e.target.value || null)} />
          </Field>
          <Field label="Fecha límite" hint="Último día para hacerla (opcional).">
            <input type="date" value={t.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Pilar">
            <select value={t.pillar ?? ''} onChange={(e) => set('pillar', e.target.value || undefined)}>
              <option value="">—</option>
              {PILLARS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notas"><textarea value={t.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={!t.title?.trim()} onClick={async () => { await save('todos', { ...t, patient_id: currentPatientId() } as Todo); onClose() }}>Guardar</button>
        {t.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar?')) { await remove('todos', t.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
