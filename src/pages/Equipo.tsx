import { useState } from 'react'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import type { Professional, Question } from '../store/types'
import { PILLARS, PROFESSIONALS, SYMPTOMS, SEVERITY_LABELS, DRUG_LABELS } from '../domain/catalogs'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { meanIntake } from '../domain/nutrition'
import { Field, Section } from '../components/ui'

export default function Equipo() {
  const questions = useRows('questions')
  const [prof, setProf] = useState<Professional>(PROFESSIONALS[0])
  const [text, setText] = useState('')
  const [pillar, setPillar] = useState('')
  const [report, setReport] = useState(false)
  const list = questions.filter((q) => q.professional === prof)
  const pending = list.filter((q) => q.status === 'pendiente')
  const answered = list.filter((q) => q.status === 'respondida')

  if (report) return <Informe onClose={() => setReport(false)} />

  return (
    <div>
      <div className="row between">
        <h1>Preguntas al equipo</h1>
        <button className="btn sm secondary" onClick={() => setReport(true)}>Informe de consulta</button>
      </div>
      <div className="chips" style={{ marginBottom: '.6rem' }}>
        {PROFESSIONALS.map((p) => {
          const n = questions.filter((q) => q.professional === p && q.status === 'pendiente').length
          return <button key={p} type="button" className={'chip ' + (prof === p ? 'on' : '')} onClick={() => setProf(p)}>{p}{n ? ` (${n})` : ''}</button>
        })}
      </div>
      <div className="card">
        <Field label={`Nueva pregunta para ${prof}`}><textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="row">
          <select style={{ width: 'auto' }} value={pillar} onChange={(e) => setPillar(e.target.value)}>
            <option value="">Pilar…</option>
            {PILLARS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="btn sm" disabled={!text.trim()} onClick={async () => { await save('questions', { patient_id: currentPatientId(), professional: prof, question: text.trim(), pillar: pillar || undefined, status: 'pendiente' }); setText('') }}>Añadir</button>
        </div>
      </div>
      <h2>Pendientes ({pending.length})</h2>
      {pending.length === 0 && <div className="muted">Ninguna.</div>}
      {pending.map((q) => <QuestionItem key={q.id} q={q} />)}
      {answered.length > 0 && (
        <Section title={`Respondidas (${answered.length})`}>
          {answered.map((q) => <QuestionItem key={q.id} q={q} />)}
        </Section>
      )}
    </div>
  )
}

function QuestionItem({ q }: { q: Question }) {
  const [answer, setAnswer] = useState(q.answer ?? '')
  const [open, setOpen] = useState(false)
  return (
    <div className="card tight" style={{ marginBottom: '.4rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        {q.pillar && <span className="tag gray">{q.pillar}</span>}
        {q.question}
        {q.status === 'respondida' && <div className="small" style={{ marginTop: '.3rem' }}><strong>Respuesta:</strong> {q.answer} <span className="muted">({q.answered_by}, {fmtDate(q.answered_at)})</span></div>}
      </div>
      {open && (
        <div style={{ marginTop: '.5rem' }}>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Respuesta recibida" />
          <div className="row" style={{ marginTop: '.3rem' }}>
            <button className="btn sm" disabled={!answer.trim()} onClick={() => save('questions', { ...q, answer: answer.trim(), status: 'respondida', answered_by: backend.currentUserName(), answered_at: todayStr() })}>Guardar respuesta</button>
            {q.status === 'respondida' && <button className="btn sm ghost" onClick={() => save('questions', { ...q, status: 'pendiente' })}>Reabrir</button>}
            <button className="btn sm danger" onClick={() => { if (confirm('¿Borrar la pregunta?')) remove('questions', q.id) }}>Borrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Informe de consulta de una página (imprimible desde el navegador). */
function Informe({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState(addDays(todayStr(), -21))
  const [to, setTo] = useState(todayStr())
  const [prof, setProf] = useState<string>('')
  const patient = backend.all('patients')[0]
  const logs = backend.all('daily_logs').filter((l) => l.date >= from && l.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  const cycles = backend.all('cycles')
  const products = backend.all('products').filter((p) => !p.end_date || p.end_date >= from)
  const questions = backend.all('questions').filter((q) => q.status === 'pendiente' && (!prof || q.professional === prof))
  const weights = [
    ...logs.filter((l) => l.weight != null).map((l) => `${l.date.slice(5)}: ${l.weight} kg`),
    ...backend.all('weights').filter((w) => w.at.slice(0, 10) >= from && w.at.slice(0, 10) <= to).sort((a, b) => a.at.localeCompare(b.at)).map((w) => `${w.at.slice(5, 10)}: ${w.kg} kg (${w.source === 'inbody' ? 'InBody' : w.source === 'hospital' ? 'hospital' : 'casa'})`),
  ]
  const fevers = logs.filter((l) => (l.temp_max ?? 0) >= 38).map((l) => `${fmtDate(l.date)} (${l.temp_max} °C)`)
  const intakes = logs.map((l) => meanIntake(l.meals)).filter((x): x is number => x != null)
  const sympCounts: Record<string, number[]> = {}
  for (const l of logs) for (const [k, v] of Object.entries(l.symptoms)) if (v > 0) (sympCounts[k] ??= [0, 0, 0, 0])[v]++
  const sleep = logs.filter((l) => l.sleep_start && l.sleep_end)
  const act = logs.filter((l) => l.activity_min != null)
  const prevDays = logs.filter((l) => Object.keys(l.preventive).length)
  const prevRate = prevDays.length ? Math.round((prevDays.reduce((a, l) => a + Object.values(l.preventive).filter(Boolean).length, 0) / prevDays.reduce((a, l) => a + Object.keys(l.preventive).length, 0)) * 100) : null
  const ctxTo = cycleContext(cycles, to)
  return (
    <div>
      <div className="row between no-print">
        <h1>Informe de consulta</h1>
        <div className="row">
          <button className="btn sm secondary" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="btn sm ghost" onClick={onClose}>Volver</button>
        </div>
      </div>
      <div className="row no-print" style={{ marginBottom: '.6rem' }}>
        <input type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
        <select style={{ width: 'auto' }} value={prof} onChange={(e) => setProf(e.target.value)}>
          <option value="">Todos los profesionales</option>
          {PROFESSIONALS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="card" id="informe">
        <h2 style={{ marginTop: 0 }}>{patient?.name} — {fmtDate(from)} a {fmtDate(to)}</h2>
        <p className="small">{ctxTo.cycle ? `Ciclo ${ctxTo.cycle.number} (${ctxTo.cycle.drugs.map((d) => DRUG_LABELS[d]).join(' + ')}), D${ctxTo.day} a fecha del informe.` : 'Sin ciclo activo.'} {patient?.protocol} {patient?.arm ? `· brazo ${patient.arm}` : ''}</p>
        <h3>Peso</h3><p className="small">{weights.length ? weights.join(' · ') : 'Sin pesadas registradas'}</p>
        <h3>Ingesta</h3><p className="small">{intakes.length ? `Media ${Math.round((intakes.reduce((a, b) => a + b, 0) / intakes.length) * 100)} % del plato servido en ${intakes.length} días; días con menos de la mitad: ${intakes.filter((i) => i < 0.5).length}` : 'Sin datos'}</p>
        <h3>Fiebre</h3><p className="small">{fevers.length ? fevers.join(' · ') : 'Ningún día con ≥ 38 °C'}</p>
        <h3>Síntomas (días por intensidad)</h3>
        <table className="table"><tbody>
          {Object.entries(sympCounts).map(([k, c]) => (
            <tr key={k}><td>{SYMPTOMS.find((s) => s.key === k)?.label ?? k}</td><td>{[1, 2, 3].map((g) => c[g] ? `${SEVERITY_LABELS[g]}: ${c[g]} d` : '').filter(Boolean).join(' · ')}</td></tr>
          ))}
          {Object.keys(sympCounts).length === 0 && <tr><td>Sin síntomas registrados</td></tr>}
        </tbody></table>
        <h3>Sueño y actividad</h3>
        <p className="small">
          {sleep.length ? `Despertares medios: ${(sleep.reduce((a, l) => a + (l.wakeups ?? 0), 0) / sleep.length).toFixed(1)}/noche (${sleep.length} noches). ` : ''}
          {act.length ? `Actividad media ${Math.round(act.reduce((a, l) => a + (l.activity_min ?? 0), 0) / act.length)} min/día; pasos medios ${Math.round(act.filter((l) => l.steps).reduce((a, l) => a + (l.steps ?? 0), 0) / Math.max(1, act.filter((l) => l.steps).length))}.` : ''}
          {!sleep.length && !act.length && 'Sin datos'}
        </p>
        <h3>Cuidados preventivos</h3><p className="small">{prevRate != null ? `Cumplimiento ${prevRate} % de los ítems marcados en ${prevDays.length} días` : 'Sin datos'}</p>
        <h3>Todo lo que toma</h3>
        <table className="table"><tbody>
          {products.map((p) => <tr key={p.id}><td>{p.name}</td><td className="small">{p.dose} · {p.moments.join(', ')}{p.prescribed_by ? ` · ${p.prescribed_by}` : ''}{p.end_date ? ` · retirado ${p.end_date}` : ''}</td></tr>)}
        </tbody></table>
        <h3>Preguntas pendientes{prof ? ` para ${prof}` : ''}</h3>
        <ol className="small">{questions.map((q) => <li key={q.id}>{q.question} <span className="muted">({q.professional})</span></li>)}</ol>
        {questions.length === 0 && <p className="small muted">Ninguna.</p>}
        <p className="muted small">Registro elaborado por la familia con la app Cuaderno de cuidados. No sustituye la valoración clínica.</p>
      </div>
      <style>{`@media print { .topbar, .tabbar, .no-print { display: none !important } .content { padding: 0 } .card { border: none } }`}</style>
    </div>
  )
}
