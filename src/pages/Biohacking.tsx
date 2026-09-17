import { useState } from 'react'
import { Link } from 'react-router-dom'
import { currentPatientId, remove, save, useRows } from '../store'
import type { Practice, PracticeLog, Safety } from '../store/types'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { Check, Field, Section, Segmented } from '../components/ui'

export const EXPOSURE_ITEMS = [
  { key: 'limpieza', label: 'Productos de limpieza sin fragancia; sin ambientadores' },
  { key: 'humo', label: 'Cero humo de tabaco en casa y coche' },
  { key: 'cosmetica', label: 'Higiene y cosmética mínima, sin perfume' },
  { key: 'plasticos', label: 'Sin calentar comida en plástico' },
  { key: 'agua', label: 'Agua de bebida filtrada o embotellada' },
  { key: 'obras', label: 'Sin obras, tierra removida ni jardinería cerca del niño' },
  { key: 'animales', label: 'El niño no maneja heces ni arenero de animales' },
  { key: 'ventilacion', label: 'Ventilación diaria de las habitaciones' },
]

const DEFAULT_PRACTICES: Omit<Practice, keyof import('../store/types').BaseRow>[] = [
  { name: 'Luz infrarroja / roja (mañana y noche)', safety: 'verde', safety_reason: 'Sin contraindicación conocida; evitar sobre el apósito del catéter', active: true },
  { name: 'Gafas de bloqueo de luz azul por la noche', safety: 'verde', active: true },
  { name: 'Paseo con luz natural (mañana / tarde)', safety: 'verde', safety_reason: 'En el valle D7-14 evitar aglomeraciones', active: true },
  { name: 'Respiración / relajación guiada', safety: 'verde', active: true },
  { name: 'Grounding descalzo sobre tierra, hierba o arena', safety: 'rojo', safety_reason: 'Neutropenia: riesgo de infección por corte o pinchazo. Solo con autorización escrita', active: true },
  { name: 'Baño frío / inmersión', safety: 'rojo', safety_reason: 'Catéter central: compromete el apósito. Inmersión no', active: true },
  { name: 'Sauna / calor intenso', safety: 'rojo', safety_reason: 'Deshidratación, hipotensión; no en tratamiento activo sin autorización', active: true },
  { name: 'Ayuno intermitente', safety: 'rojo', safety_reason: 'Tratamiento activo pediátrico: solo con autorización escrita del hospital', active: true },
  { name: 'Sábana o pulsera de conexión a tierra', safety: 'ambar', safety_reason: 'Sin riesgo infeccioso; consultar por el catéter y dispositivos', active: true },
  { name: 'Suplementación cronobiológica (hora de tomas)', safety: 'ambar', safety_reason: 'Se plantea al equipo como pregunta; no se decide en casa', active: true },
]

/** Pilar 9 · Biohacking: sueño y ritmo circadiano (se registra en el Diario), exposiciones (semanal) y prácticas con semáforo de seguridad. */
export default function Biohacking() {
  const today = todayStr()
  const ws = weekStart(today)
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const exposures = useRows('exposures_weekly')
  const practices = useRows('practices', (p) => p.active)
  const plog = useRows('practice_log', (l) => l.date === today)
  const ctx = cycleContext(cycles, today)
  const [editing, setEditing] = useState<Partial<Practice> | null>(null)
  const thisWeek = exposures.find((e) => e.week_start === ws)
  const [exp, setExp] = useState<Record<string, boolean>>(thisWeek?.items ?? {})
  const [expNotes, setExpNotes] = useState(thisWeek?.notes ?? '')

  const byDate = new Map(logs.map((l) => [l.date, l]))
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const hours = (s?: string | null, e?: string | null) => {
    if (!s || !e) return null
    const [sh, sm] = s.split(':').map(Number)
    const [eh, em] = e.split(':').map(Number)
    let h = eh + em / 60 - (sh + sm / 60)
    if (h < 0) h += 24
    return Math.round(h * 10) / 10
  }
  const withSleep = days.map((d) => byDate.get(d)).filter((l): l is NonNullable<typeof l> => !!l)
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  const sleepH = withSleep.map((l) => hours(l.sleep_start, l.sleep_end)).filter((x): x is number => x != null)
  const adherence = (k: 'ir_morning' | 'ir_night' | 'glasses' | 'daylight_morning' | 'daylight_afternoon' | 'sun_exposure') => (withSleep.length ? Math.round((withSleep.filter((l) => l[k]).length / withSleep.length) * 100) : null)
  const causes: Record<string, number> = {}
  for (const l of withSleep) if (l.wakeup_cause && (l.wakeups ?? 0) > 0) causes[l.wakeup_cause] = (causes[l.wakeup_cause] ?? 0) + 1

  if (editing) return <PracticeForm initial={editing} onClose={() => setEditing(null)} />

  const togglePractice = async (p: Practice) => {
    const ex = plog.find((l) => l.practice_id === p.id)
    if (ex) await remove('practice_log', ex.id)
    else await save('practice_log', { patient_id: currentPatientId(), date: today, practice_id: p.id } as PracticeLog)
  }
  const blocked = (p: Practice) => p.safety === 'rojo' && !p.authorized_by

  return (
    <div>
      <h1>Biohacking</h1>
      <p className="muted small">Sueño, luz y prácticas diarias se marcan en el <Link to="/diario">Registro diario</Link>. Aquí: tendencias, exposiciones de la semana y el catálogo de prácticas con su semáforo de seguridad.</p>

      <Section title="Sueño y ritmo circadiano · 14 días" open>
        {withSleep.length === 0 ? <div className="muted">Sin registros de sueño.</div> : (
          <>
            <div className="grid3">
              <div><div className="muted small">Horas dormidas</div><strong>{avg(sleepH) ?? '—'} h</strong></div>
              <div><div className="muted small">Despertares / noche</div><strong>{avg(withSleep.map((l) => l.wakeups ?? 0))}</strong></div>
              <div><div className="muted small">Causa más frecuente</div><strong>{Object.entries(causes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}</strong></div>
            </div>
            <h3>Cumplimiento de los sincronizadores</h3>
            <div className="table-wrap"><table className="table"><tbody>
              {([['ir_morning', 'Luz infrarroja mañana'], ['ir_night', 'Luz infrarroja noche'], ['glasses', 'Gafas de bloqueo azul'], ['daylight_morning', 'Luz natural mañana'], ['daylight_afternoon', 'Luz natural tarde'], ['sun_exposure', 'Exposición solar cuidada']] as const).map(([k, label]) => (
                <tr key={k}><td>{label}</td><td>{adherence(k)} %</td><td><span style={{ display: 'inline-block', width: 80, height: 8, background: 'var(--line)', borderRadius: 4 }}><span style={{ display: 'block', width: `${adherence(k)}%`, height: 8, background: 'var(--primary)', borderRadius: 4 }} /></span></td></tr>
              ))}
            </tbody></table></div>
            <div className="spark" style={{ marginTop: '.5rem' }}>{days.map((d) => { const l = byDate.get(d); const h = l ? hours(l.sleep_start, l.sleep_end) : null; return <span key={d} style={{ height: `${h ? Math.min(40, (h / 12) * 40) : 2}px` }} title={`${fmtDate(d)}: ${h ?? '—'} h`} /> })}</div>
            <div className="muted small">Horas dormidas por noche (últimos 14 días)</div>
          </>
        )}
      </Section>

      <Section title={`Carga tóxica y exposiciones · semana del ${fmtDate(ws)}`} open={!thisWeek}>
        <p className="muted small">Una vez a la semana. Marca lo que se cumple; anota cambios (nuevo producto, obra en el edificio…).</p>
        {EXPOSURE_ITEMS.map((i) => <Check key={i.key} checked={!!exp[i.key]} onChange={(v) => setExp({ ...exp, [i.key]: v })}>{i.label}</Check>)}
        {ctx.nadir && <div className="notice">Valle D7-14: además, sin aglomeraciones ni visitas con síntomas.</div>}
        <Field label="Cambios o notas"><textarea value={expNotes} onChange={(e) => setExpNotes(e.target.value)} /></Field>
        <button className="btn sm" onClick={() => save('exposures_weekly', { ...(thisWeek ?? {}), patient_id: currentPatientId(), week_start: ws, items: exp, notes: expNotes } as never)}>Guardar semana</button>
        {exposures.length > 0 && <div className="muted small" style={{ marginTop: '.5rem' }}>Semanas registradas: {exposures.length} · última cumplió {thisWeek ? Object.values(thisWeek.items).filter(Boolean).length : '—'}/{EXPOSURE_ITEMS.length}</div>}
      </Section>

      <Section title="Otras prácticas (con semáforo de seguridad)" open right={<button className="btn sm ghost" onClick={(e) => { e.preventDefault(); setEditing({ safety: 'ambar', active: true }) }}>+</button>}>
        <p className="muted small">Verde: sin contraindicación · Ámbar: consultar al equipo · Rojo: no en neutropenia o con catéter central salvo autorización escrita (queda anotada aquí).</p>
        {practices.length === 0 && (
          <button className="btn sm secondary" onClick={async () => { for (const p of DEFAULT_PRACTICES) await save('practices', { ...p, patient_id: currentPatientId() } as Practice) }}>Cargar catálogo inicial</button>
        )}
        {practices.map((p) => {
          const done = plog.some((l) => l.practice_id === p.id)
          return (
            <div className="item" key={p.id}>
              <input type="checkbox" checked={done} disabled={blocked(p)} onChange={() => togglePractice(p)} title={blocked(p) ? 'Bloqueada: requiere autorización escrita' : 'Hecho hoy'} />
              <div className="main" onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
                <div><span className={'tag ' + p.safety}>{p.safety}</span>{p.name}</div>
                <div className="meta">{p.safety_reason}{p.authorized_by ? ` · Autorizado por ${p.authorized_by}` : ''}</div>
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function PracticeForm({ initial, onClose }: { initial: Partial<Practice>; onClose: () => void }) {
  const [p, setP] = useState(initial)
  return (
    <div>
      <div className="row between"><h1>{p.id ? 'Práctica' : 'Nueva práctica'}</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        <Field label="Nombre"><input type="text" value={p.name ?? ''} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Semáforo de seguridad en tratamiento activo">
          <Segmented className="severity" options={[{ value: 'verde' as Safety, label: 'Verde', className: 's1' }, { value: 'ambar' as Safety, label: 'Ámbar', className: 's2' }, { value: 'rojo' as Safety, label: 'Rojo', className: 's3' }]} value={p.safety} onChange={(v) => setP({ ...p, safety: v ?? 'ambar' })} />
        </Field>
        <Field label="Motivo"><input type="text" value={p.safety_reason ?? ''} onChange={(e) => setP({ ...p, safety_reason: e.target.value })} /></Field>
        <Field label="Autorizado por (si es ámbar o rojo)" hint="Con autorización anotada, la práctica se puede marcar como hecha"><input type="text" value={p.authorized_by ?? ''} onChange={(e) => setP({ ...p, authorized_by: e.target.value })} /></Field>
        <Check checked={p.active !== false} onChange={(v) => setP({ ...p, active: v })}>Activa (aparece en la lista)</Check>
        <Field label="Notas"><textarea value={p.notes ?? ''} onChange={(e) => setP({ ...p, notes: e.target.value })} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={!p.name?.trim()} onClick={async () => { await save('practices', { ...p, patient_id: currentPatientId() } as Practice); onClose() }}>Guardar</button>
        {p.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar?')) { await remove('practices', p.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
