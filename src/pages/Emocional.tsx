import { useState } from 'react'
import { backend, currentPatientId, save, useRows } from '../store'
import type { CaregiverDaily, WeeklyCaregiver, WeeklyChild } from '../store/types'
import { EMOTIONS, MOOD_FACES, ZARIT7, ZARIT_CUTOFF, ZARIT_SCALE } from '../domain/catalogs'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { Check, Faces, Field, Section, Segmented } from '../components/ui'
import { knownUsers } from '../domain/users'

export default function Emocional() {
  const me = backend.currentUserId()
  const ws = weekStart(todayStr())
  const child = useRows('weekly_child')
  const caregivers = useRows('weekly_caregiver')
  const daily = useRows('caregiver_daily')
  const [tab, setTab] = useState<'nino' | 'cuidadora'>('nino')
  const thisChild = child.find((c) => c.week_start === ws)
  const [c, setC] = useState<Partial<WeeklyChild>>(thisChild ?? { week_start: ws, emotions: {} })
  const mine = caregivers.find((w) => w.week_start === ws && w.user_id === me)
  const [w, setW] = useState<Partial<WeeklyCaregiver>>(mine ?? { week_start: ws, user_id: me, zarit: [] })
  const todayDaily = daily.find((d) => d.date === todayStr() && d.user_id === me)
  const [d, setD] = useState<Partial<CaregiverDaily>>(todayDaily ?? { date: todayStr(), user_id: me })
  const users = knownUsers()

  const zaritTotal = (w.zarit ?? []).reduce((a, b) => a + (b ?? 0), 0)
  const zaritDone = (w.zarit ?? []).filter((x) => x != null).length === 7
  const history = caregivers.filter((x) => x.user_id === me).sort((a, b) => a.week_start.localeCompare(b.week_start))

  const saveCaregiver = async () => {
    await save('weekly_caregiver', { ...w, patient_id: currentPatientId(), user_id: me } as WeeklyCaregiver)
    const prev = history.filter((h) => h.week_start < ws).slice(-1)[0]
    const prevTotal = prev ? prev.zarit.reduce((a, b) => a + b, 0) : null
    const rising = prevTotal != null && zaritTotal > prevTotal
    if (zaritDone && (zaritTotal >= ZARIT_CUTOFF || rising)) {
      const exists = backend.all('todos').some((t) => t.origin === 'cuidadora' && t.status === 'pendiente')
      if (!exists) {
        await save('todos', {
          patient_id: currentPatientId(),
          title: 'Organizar relevo / revisar reparto de tareas: la cuidadora principal muestra señales de sobrecarga',
          pillar: 'Emocional', assignees: users.filter((u) => u.id !== me).map((u) => u.id), priority: 'importante', origin: 'cuidadora', status: 'pendiente', do_date: todayStr(),
        })
      }
    }
  }

  return (
    <div>
      <h1>Emocional y familiar</h1>
      <Segmented options={[{ value: 'nino', label: 'El niño' }, { value: 'cuidadora', label: 'Cuidador/a (tú)' }]} value={tab} onChange={(v) => setTab(v ?? 'nino')} />

      {tab === 'nino' && (
        <div className="card" style={{ marginTop: '.6rem' }}>
          <p className="muted small">Semana del {fmtDate(ws)}. Que lo marque él si quiere.</p>
          <Field label="¿Cómo te sientes esta semana?"><Faces value={c.mood} onChange={(v) => setC({ ...c, mood: v })} faces={MOOD_FACES} /></Field>
          <h3>Emociones que han predominado (0-5)</h3>
          {EMOTIONS.map((e) => (
            <div key={e.key} className="row between" style={{ marginBottom: '.3rem' }}>
              <span style={{ width: 150 }}>{e.emoji} {e.label}</span>
              <div className="seg" style={{ flex: 1 }}>
                {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={(c.emotions?.[e.key] ?? 0) === n ? 'on' : ''} onClick={() => setC({ ...c, emotions: { ...(c.emotions ?? {}), [e.key]: n } })}>{n}</button>)}
              </div>
            </div>
          ))}
          <Field label="¿Te has sentido a gusto con tu cuerpo esta semana?"><Faces value={c.body_image} onChange={(v) => setC({ ...c, body_image: v })} faces={MOOD_FACES} /></Field>
          <Check checked={!!c.psych_session} onChange={(v) => setC({ ...c, psych_session: v })}>Sesión con la psicóloga esta semana</Check>
          <Field label="Contacto con amigos / cole"><Segmented options={[{ value: 'no', label: 'No' }, { value: 'presencial', label: 'Presencial' }, { value: 'video', label: 'Videollamada' }, { value: 'mensajes', label: 'Mensajes' }]} value={c.friends_contact} onChange={(v) => setC({ ...c, friends_contact: v ?? undefined })} /></Field>
          <Field label="Algo que ha decidido él esta semana"><input type="text" value={c.decided ?? ''} onChange={(e) => setC({ ...c, decided: e.target.value })} /></Field>
          <Field label="Notas"><textarea value={c.notes ?? ''} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field>
          <button className="btn" onClick={() => save('weekly_child', { ...c, patient_id: currentPatientId() } as WeeklyChild)}>Guardar semana</button>
          {child.length > 1 && (
            <Section title="Semanas anteriores">
              {child.sort((a, b) => b.week_start.localeCompare(a.week_start)).map((x) => <div key={x.id} className="small">{fmtDate(x.week_start)}: ánimo {x.mood ? MOOD_FACES[x.mood - 1] : '—'} · {Object.entries(x.emotions).filter(([, v]) => v >= 3).map(([k]) => EMOTIONS.find((e) => e.key === k)?.label).join(', ')}</div>)}
            </Section>
          )}
        </div>
      )}

      {tab === 'cuidadora' && (
        <div style={{ marginTop: '.6rem' }}>
          <div className="card">
            <h3>Hoy, en tres toques (opcional)</h3>
            <div className="grid3">
              <Field label="Horas dormidas"><input type="number" inputMode="decimal" step="0.5" value={d.sleep_h ?? ''} onChange={(e) => setD({ ...d, sleep_h: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="¿Has comido bien?"><Segmented options={[{ value: 1, label: 'Sí' }, { value: 0, label: 'No' }]} value={d.ate_ok == null ? null : d.ate_ok ? 1 : 0} onChange={(v) => setD({ ...d, ate_ok: v == null ? null : v === 1 })} /></Field>
              <Field label="Cansancio 1-5"><Segmented options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={d.tired} onChange={(v) => setD({ ...d, tired: v })} /></Field>
            </div>
            <button className="btn sm secondary" onClick={() => save('caregiver_daily', { ...d, patient_id: currentPatientId(), user_id: me } as CaregiverDaily)}>Guardar hoy</button>
          </div>
          <div className="card">
            <h3>Semana del {fmtDate(ws)} — 2 minutos</h3>
            <p className="muted small">Escala de Zarit reducida. No hay respuestas buenas ni malas; sirve para que los demás puedan echar una mano a tiempo.</p>
            {ZARIT7.map((q, i) => (
              <div key={i} style={{ marginBottom: '.5rem' }}>
                <div className="small">{q}</div>
                <div className="seg">{ZARIT_SCALE.map((l, n) => <button key={n} type="button" className={w.zarit?.[i] === n ? 'on' : ''} onClick={() => { const z = [...(w.zarit ?? [])]; z[i] = n; setW({ ...w, zarit: z }) }}>{l}</button>)}</div>
              </div>
            ))}
            <Check checked={!!w.relief} onChange={(v) => setW({ ...w, relief: v })}>He tenido algún relevo esta semana</Check>
            <Check checked={!!w.self_time} onChange={(v) => setW({ ...w, self_time: v })}>He hecho algo solo para mí</Check>
            <Field label="¿Qué ha sido lo más difícil esta semana?"><textarea value={w.hardest ?? ''} onChange={(e) => setW({ ...w, hardest: e.target.value })} /></Field>
            {zaritDone && <div className={'notice'}>Puntuación: <strong>{zaritTotal}/28</strong>{zaritTotal >= ZARIT_CUTOFF ? ' — sobrecarga intensa: se avisará a los demás para organizar relevo.' : ''}</div>}
            <button className="btn" onClick={saveCaregiver}>Guardar semana</button>
          </div>
          {history.length > 1 && (
            <div className="card">
              <h3>Tendencia</h3>
              <div className="spark">{history.map((h) => { const t = h.zarit.reduce((a, b) => a + b, 0); return <span key={h.id} className={t >= ZARIT_CUTOFF ? 'out' : ''} style={{ height: `${Math.max(4, (t / 28) * 40)}px` }} title={`${h.week_start}: ${t}`} /> })}</div>
              <div className="muted small">{history.map((h) => `${h.week_start.slice(5)}: ${h.zarit.reduce((a, b) => a + b, 0)}`).join(' · ')} · desde {fmtDate(addDays(history[0].week_start, 0))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
