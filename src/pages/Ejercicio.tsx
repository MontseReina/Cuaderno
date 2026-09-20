import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import { emptyLog } from '../store/useDailyDraft'
import type { DailyLog, ExerciseSession, FunctionalDaily } from '../store/types'
import { fmtDate, todayStr } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { ACTIVITIES } from '../domain/catalogs'
import { Check, Field, Section, Segmented } from '../components/ui'

const TRAMO: Record<string, string> = {
  en_ciclo: 'D0-4: movilización, levantarse, paseos cortos. Nada de encamamiento total.',
  valle: 'D5-14 (valle): actividad ligera, sin exigencia. Sin contacto ni frotar fuerte si hay trombopenia.',
  recuperacion: 'D15-21: ventana de mayor capacidad. Buen momento para fuerza y aeróbico.',
  previo: 'Antes del ciclo: mantener rutina.',
  sin_ciclos: '',
}

/** Pilar 7 · Ejercicio. Una ficha por día: actividad y pasos, capacidad funcional y
 *  el detalle de la sesión se guardan juntos al dar a Guardar. */
export default function Ejercicio() {
  const params = useParams()
  const sessions = useRows('exercise_sessions').sort((a, b) => b.date.localeCompare(a.date))
  const logs = useRows('daily_logs')
  const weeklyOld = useRows('functional_weekly').sort((a, b) => b.week_start.localeCompare(a.week_start))
  const cycles = useRows('cycles')
  const patient = backend.all('patients')[0]
  const ctx = cycleContext(cycles, todayStr())
  const names = Array.from(new Set(sessions.flatMap((s) => s.exercises.map((e) => e.name))))
  const nueva = (date: string): Partial<ExerciseSession> => ({ date, kind: 'fuerza', exercises: [] })
  const [editing, setEditing] = useState<Partial<ExerciseSession> | null>(() =>
    params.date ? (sessions.find((s) => s.date === params.date) ?? nueva(params.date)) : null,
  )

  if (editing) return <SessionForm initial={editing} names={names} onClose={() => setEditing(null)} />

  const byDate = new Map(logs.map((l) => [l.date, l]))
  const resumenDia = (l: DailyLog | undefined) => {
    if (!l) return ''
    const acts = Object.entries(l.activity ?? {}).filter(([, v]) => v).map(([k]) => ACTIVITIES.find((a) => a.key === k)?.label ?? k)
    const f = l.extra?.functional
    const fn = [f?.stairs && 'sube escaleras', f?.stands_alone && 'se levanta solo', f?.walk_min != null && `paseo ${f.walk_min} min`, f?.falls && `caídas: ${f.falls}`].filter(Boolean)
    return [acts.join(', '), l.activity_min ? `${l.activity_min} min` : '', l.steps ? `${l.steps} pasos` : '', fn.join(' · ')].filter(Boolean).join(' · ')
  }

  return (
    <div>
      <div className="row between">
        <h1>Ejercicio y composición corporal</h1>
        <button className="btn sm" onClick={() => setEditing(sessions.find((s) => s.date === todayStr()) ?? nueva(todayStr()))}>+ Sesión</button>
      </div>
      {TRAMO[ctx.phase] && <div className="notice">{ctx.cycle ? `D${ctx.day}. ` : ''}{TRAMO[ctx.phase]}</div>}
      {patient?.load_limits && <div className="notice"><strong>Límites de traumatología:</strong> {patient.load_limits}</div>}
      <p className="muted small">Cada sesión es la ficha del día: actividad y pasos, capacidad funcional y los ejercicios con detalle (series, repeticiones, carga), que puede rellenar el entrenador.</p>

      <h2>Sesiones</h2>
      {sessions.length === 0 && <div className="empty">Sin sesiones registradas. Pulsa «+ Sesión» para la de hoy.</div>}
      {sessions.map((s) => (
        <div className="card tight" key={s.id} onClick={() => setEditing(s)} style={{ cursor: 'pointer', marginBottom: '.4rem' }}>
          <div className="row between">
            <strong>{fmtDate(s.date)} · {s.kind === 'fuerza' ? 'Fuerza' : 'Aeróbico'}</strong>
            {s.minutes ? <span className="tag gray">{s.minutes} min</span> : null}
          </div>
          <div className="small">{s.kind === 'fuerza' ? s.exercises.map((e) => `${e.name} ${e.sets ?? '?'}×${e.reps ?? '?'}${e.load ? ` @ ${e.load}` : ''}`).join(' · ') : `${s.exercises.map((e) => e.name).join(', ')}${s.intensity ? ` · intensidad ${s.intensity}` : ''}`}</div>
          {resumenDia(byDate.get(s.date)) && <div className="meta">{resumenDia(byDate.get(s.date))}</div>}
        </div>
      ))}

      {weeklyOld.length > 0 && (
        <Section title={`Capacidad funcional · registros semanales anteriores (${weeklyOld.length})`}>
          <p className="muted small">Se guardaban por semana; ahora va dentro de cada sesión, por día. Se conservan para no perder el histórico.</p>
          {weeklyOld.map((f) => (
            <div className="item" key={f.id}>
              <div className="main">
                <div className="small">Semana del {fmtDate(f.week_start)}</div>
                <div className="meta">{[f.stairs && 'sube escaleras', f.stands_alone && 'se levanta solo', f.walk_min != null && `paseo ${f.walk_min} min`, f.falls && `caídas: ${f.falls}`].filter(Boolean).join(' · ') || 'sin datos'}</div>
              </div>
              <button className="btn sm ghost" title="Borrar este registro" onClick={() => { if (confirm(`¿Borrar el registro de la semana del ${fmtDate(f.week_start)}?`)) remove('functional_weekly', f.id) }}>✕</button>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

interface DayPart {
  activity: Record<string, boolean>
  activity_min: number | null
  steps: number | null
  functional: FunctionalDaily
}
const fromLog = (l: DailyLog | undefined): DayPart => ({
  activity: l?.activity ?? {},
  activity_min: l?.activity_min ?? null,
  steps: l?.steps ?? null,
  functional: l?.extra?.functional ?? {},
})

function SessionForm({ initial, names, onClose }: { initial: Partial<ExerciseSession>; names: string[]; onClose: () => void }) {
  const [s, setS] = useState<Partial<ExerciseSession>>({ exercises: [], ...initial })
  const logs = useRows('daily_logs')
  const date = s.date ?? todayStr()
  const [day, setDay] = useState<DayPart>(() => fromLog(logs.find((l) => l.date === date)))
  const setF = (patch: Partial<FunctionalDaily>) => setDay((d) => ({ ...d, functional: { ...d.functional, ...patch } }))
  const ex = s.exercises ?? []
  const setEx = (i: number, patch: Partial<ExerciseSession['exercises'][number]>) => setS({ ...s, exercises: ex.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  // Al cambiar la fecha, cargar la actividad y la capacidad funcional de ese día.
  useEffect(() => {
    setDay(fromLog(logs.find((l) => l.date === date)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const guardar = async () => {
    await save('exercise_sessions', { ...s, date, exercises: ex.filter((e) => e.name.trim()), patient_id: currentPatientId() } as ExerciseSession)
    const base = logs.find((l) => l.date === date)
    await save('daily_logs', {
      ...(base ?? emptyLog(date)),
      patient_id: currentPatientId(),
      date,
      activity: day.activity,
      activity_min: day.activity_min,
      steps: day.steps,
      extra: { ...(base?.extra ?? {}), functional: day.functional },
    } as DailyLog)
    onClose()
  }

  return (
    <div>
      <div className="row between"><h1>Sesión del día</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>

      <Section title="Día y tipo de sesión" open>
        <div className="grid2">
          <Field label="Fecha"><input type="date" max={todayStr()} value={s.date ?? ''} onChange={(e) => setS({ ...s, date: e.target.value })} /></Field>
          <Field label="Tipo"><Segmented options={[{ value: 'fuerza', label: 'Fuerza' }, { value: 'aerobico', label: 'Aeróbico' }]} value={s.kind} onChange={(v) => setS({ ...s, kind: v ?? 'fuerza' })} /></Field>
        </div>
      </Section>

      <Section title="Actividad y pasos del día" open>
        <p className="muted small">Lo que ha hecho en todo el día. Si hay dos sesiones el mismo día, estos datos son los del día y se comparten.</p>
        <div className="chips">
          {ACTIVITIES.map((a) => (
            <button key={a.key} type="button" className={'chip ' + (day.activity[a.key] ? 'on' : '')} onClick={() => setDay({ ...day, activity: { ...day.activity, [a.key]: !day.activity[a.key] } })}>{a.label}</button>
          ))}
        </div>
        <div className="grid2">
          <Field label="Minutos totales aprox.">
            <Segmented options={[5, 15, 30, 45, 60].map((m) => ({ value: m, label: m === 60 ? '60+' : String(m) }))} value={day.activity_min} onChange={(v) => setDay({ ...day, activity_min: v })} />
          </Field>
          <Field label="Pasos (del reloj del cuidador)"><input type="number" inputMode="numeric" min={0} value={day.steps ?? ''} onChange={(e) => setDay({ ...day, steps: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        </div>
      </Section>

      <Section title="Capacidad funcional de hoy" open>
        <Check checked={!!day.functional.stairs} onChange={(v) => setF({ stairs: v })}>Sube escaleras</Check>
        <Check checked={!!day.functional.stands_alone} onChange={(v) => setF({ stands_alone: v })}>Se levanta solo de la silla</Check>
        <div className="grid2">
          <Field label="Aguanta un paseo de (min)"><input type="number" inputMode="numeric" min={0} value={day.functional.walk_min ?? ''} onChange={(e) => setF({ walk_min: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          <Field label="Caídas o golpes en el miembro afectado"><input type="text" value={day.functional.falls ?? ''} onChange={(e) => setF({ falls: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title={s.kind === 'fuerza' ? 'Ejercicios (series × repeticiones @ carga)' : 'Actividad de la sesión'} open>
        {ex.map((e, i) => (
          <div key={i} className="row" style={{ marginBottom: '.3rem' }}>
            <input type="text" list="exnames" placeholder="ejercicio" value={e.name} onChange={(ev) => setEx(i, { name: ev.target.value })} style={{ flex: '1 1 100%' }} />
            {s.kind === 'fuerza' && (
              <>
                <input type="number" placeholder="series" value={e.sets ?? ''} onChange={(ev) => setEx(i, { sets: ev.target.value === '' ? undefined : Number(ev.target.value) })} style={{ width: 60 }} />
                <input type="number" placeholder="reps" value={e.reps ?? ''} onChange={(ev) => setEx(i, { reps: ev.target.value === '' ? undefined : Number(ev.target.value) })} style={{ width: 60 }} />
                <input type="text" placeholder="kg / banda" value={e.load ?? ''} onChange={(ev) => setEx(i, { load: ev.target.value })} style={{ width: 90 }} />
              </>
            )}
            <button className="btn sm ghost" type="button" onClick={() => setS({ ...s, exercises: ex.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <datalist id="exnames">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn sm secondary" type="button" onClick={() => setS({ ...s, exercises: [...ex, { name: '' }] })}>+ Añadir</button>
        <div className="grid2" style={{ marginTop: '.5rem' }}>
          <Field label="Minutos de la sesión"><input type="number" inputMode="numeric" min={0} value={s.minutes ?? ''} onChange={(e) => setS({ ...s, minutes: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          {s.kind === 'aerobico' && <Field label="Intensidad percibida"><Segmented options={[{ value: 'ligera', label: 'Ligera' }, { value: 'moderada', label: 'Moderada' }, { value: 'costo', label: 'Le costó' }]} value={s.intensity} onChange={(v) => setS({ ...s, intensity: v ?? undefined })} /></Field>}
        </div>
        <Field label="Notas"><textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
      </Section>

      <div className="row">
        <button className="btn" disabled={!s.date} onClick={guardar}>Guardar</button>
        {s.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar esta sesión? La actividad y los pasos del día se conservan.')) { await remove('exercise_sessions', s.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
