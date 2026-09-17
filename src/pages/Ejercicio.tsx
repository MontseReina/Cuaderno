import { useState } from 'react'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { ExerciseSession, FunctionalWeekly } from '../store/types'
import { fmtDate, todayStr, weekStart } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { Check, Field, Section, Segmented } from '../components/ui'

const TRAMO: Record<string, string> = {
  en_ciclo: 'D0-4: movilización, levantarse, paseos cortos. Nada de encamamiento total.',
  valle: 'D5-14 (valle): actividad ligera, sin exigencia. Sin contacto ni frotar fuerte si hay trombopenia.',
  recuperacion: 'D15-21: ventana de mayor capacidad. Buen momento para fuerza y aeróbico.',
  previo: 'Antes del ciclo: mantener rutina.',
  sin_ciclos: '',
}

export default function Ejercicio() {
  const sessions = useRows('exercise_sessions').sort((a, b) => b.date.localeCompare(a.date))
  const functional = useRows('functional_weekly')
  const cycles = useRows('cycles')
  const patient = backend.all('patients')[0]
  const ctx = cycleContext(cycles, todayStr())
  const ws = weekStart(todayStr())
  const thisWeek = functional.find((f) => f.week_start === ws)
  const [f, setF] = useState<Partial<FunctionalWeekly>>(thisWeek ?? { week_start: ws })
  const [editing, setEditing] = useState<Partial<ExerciseSession> | null>(null)
  const names = Array.from(new Set(sessions.flatMap((s) => s.exercises.map((e) => e.name))))

  if (editing) return <SessionForm initial={editing} names={names} onClose={() => setEditing(null)} />

  return (
    <div>
      <div className="row between">
        <h1>Ejercicio y composición corporal</h1>
        <button className="btn sm" onClick={() => setEditing({ date: todayStr(), kind: 'fuerza', exercises: [] })}>+ Sesión</button>
      </div>
      {TRAMO[ctx.phase] && <div className="notice">{ctx.cycle ? `D${ctx.day}. ` : ''}{TRAMO[ctx.phase]}</div>}
      {patient?.load_limits && <div className="notice"><strong>Límites de traumatología:</strong> {patient.load_limits}</div>}
      <p className="muted small">La actividad diaria (paseo, juego, minutos, pasos) se marca en el Registro diario. Aquí van las sesiones con detalle, que puede rellenar el entrenador.</p>

      <Section title="Capacidad funcional de esta semana" open>
        <Check checked={!!f.stairs} onChange={(v) => setF({ ...f, stairs: v })}>Sube escaleras</Check>
        <Check checked={!!f.stands_alone} onChange={(v) => setF({ ...f, stands_alone: v })}>Se levanta solo de la silla</Check>
        <Field label="Aguanta un paseo de (min)"><input type="number" value={f.walk_min ?? ''} onChange={(e) => setF({ ...f, walk_min: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Caídas o golpes en el miembro afectado"><input type="text" value={f.falls ?? ''} onChange={(e) => setF({ ...f, falls: e.target.value })} /></Field>
        <button className="btn sm secondary" onClick={() => save('functional_weekly', { ...f, patient_id: currentPatientId() } as FunctionalWeekly)}>Guardar semana</button>
      </Section>

      <h2>Sesiones</h2>
      {sessions.length === 0 && <div className="muted">Sin sesiones registradas.</div>}
      {sessions.map((s) => (
        <div className="card tight" key={s.id} onClick={() => setEditing(s)} style={{ cursor: 'pointer', marginBottom: '.4rem' }}>
          <div className="row between"><strong>{s.kind === 'fuerza' ? 'Fuerza' : 'Aeróbico'} · {fmtDate(s.date)}</strong>{s.minutes ? <span className="tag gray">{s.minutes} min</span> : null}</div>
          <div className="small">{s.kind === 'fuerza' ? s.exercises.map((e) => `${e.name} ${e.sets ?? '?'}×${e.reps ?? '?'}${e.load ? ` @ ${e.load}` : ''}`).join(' · ') : `${s.exercises.map((e) => e.name).join(', ')}${s.intensity ? ` · intensidad ${s.intensity}` : ''}`}</div>
        </div>
      ))}
    </div>
  )
}

function SessionForm({ initial, names, onClose }: { initial: Partial<ExerciseSession>; names: string[]; onClose: () => void }) {
  const [s, setS] = useState<Partial<ExerciseSession>>(initial)
  const ex = s.exercises ?? []
  const setEx = (i: number, patch: Partial<ExerciseSession['exercises'][number]>) => setS({ ...s, exercises: ex.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  return (
    <div>
      <div className="row between"><h1>Sesión</h1><button className="btn sm ghost" onClick={onClose}>Cancelar</button></div>
      <div className="card">
        <div className="grid2">
          <Field label="Fecha"><input type="date" value={s.date ?? ''} onChange={(e) => setS({ ...s, date: e.target.value })} /></Field>
          <Field label="Tipo"><Segmented options={[{ value: 'fuerza', label: 'Fuerza' }, { value: 'aerobico', label: 'Aeróbico' }]} value={s.kind} onChange={(v) => setS({ ...s, kind: v ?? 'fuerza' })} /></Field>
        </div>
        <h3>{s.kind === 'fuerza' ? 'Ejercicios (series × repeticiones @ carga)' : 'Actividad'}</h3>
        {ex.map((e, i) => (
          <div key={i} className="row" style={{ marginBottom: '.3rem' }}>
            <input type="text" list="exnames" placeholder="ejercicio" value={e.name} onChange={(ev) => setEx(i, { name: ev.target.value })} style={{ flex: 2 }} />
            {s.kind === 'fuerza' && (
              <>
                <input type="number" placeholder="series" value={e.sets ?? ''} onChange={(ev) => setEx(i, { sets: ev.target.value === '' ? undefined : Number(ev.target.value) })} style={{ width: 60 }} />
                <input type="number" placeholder="reps" value={e.reps ?? ''} onChange={(ev) => setEx(i, { reps: ev.target.value === '' ? undefined : Number(ev.target.value) })} style={{ width: 60 }} />
                <input type="text" placeholder="kg / banda" value={e.load ?? ''} onChange={(ev) => setEx(i, { load: ev.target.value })} style={{ width: 90 }} />
              </>
            )}
            <button className="btn sm ghost" onClick={() => setS({ ...s, exercises: ex.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <datalist id="exnames">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <button className="btn sm secondary" onClick={() => setS({ ...s, exercises: [...ex, { name: '' }] })}>+ Añadir</button>
        <div className="grid2" style={{ marginTop: '.5rem' }}>
          <Field label="Minutos"><input type="number" value={s.minutes ?? ''} onChange={(e) => setS({ ...s, minutes: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          {s.kind === 'aerobico' && <Field label="Intensidad percibida"><Segmented options={[{ value: 'ligera', label: 'Ligera' }, { value: 'moderada', label: 'Moderada' }, { value: 'costo', label: 'Le costó' }]} value={s.intensity} onChange={(v) => setS({ ...s, intensity: v ?? undefined })} /></Field>}
        </div>
        <Field label="Notas"><textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={!s.date} onClick={async () => { await save('exercise_sessions', { ...s, exercises: ex.filter((e) => e.name.trim()), patient_id: currentPatientId() } as ExerciseSession); onClose() }}>Guardar</button>
        {s.id && <button className="btn danger" onClick={async () => { if (confirm('¿Borrar?')) { await remove('exercise_sessions', s.id!); onClose() } }}>Borrar</button>}
      </div>
    </div>
  )
}
