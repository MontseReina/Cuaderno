import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { currentPatientId, save, useRows } from '../store'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { buildWeekly, dayLabel, type Bloque, type Light, type WeeklyData } from '../domain/weekly'
import { initials } from '../domain/exporter'
import { RegistroCard } from '../components/RegistroCard'

/** Pilar 📊 Evaluaciones (antes «Informes», renombrado el 28/09/2026): cómo se rellena el registro,
 *  el informe semanal y, en espera, el diario y el mensual. La ruta sigue siendo /informes. */
export default function Informes() {
  const { kind } = useParams()
  if (kind === 'semanal') return <Semanal />
  return (
    <div>
      <h1>📊 Evaluaciones</h1>
      <p className="muted small">Se calculan solos con lo que se apunta cada día. No hay que rellenar nada más.</p>
      <RegistroCard />
      <Link to="/informes/semanal" className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <span style={{ fontSize: '1.5rem' }}>🗓️</span>
        <span><strong>Informe semanal</strong><div className="muted small">De lunes a domingo: cómo ha ido cada bloque, alertas, qué mejorar y qué mantener. Se descarga en PDF.</div></span>
      </Link>
      <div className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', opacity: 0.55 }}>
        <span style={{ fontSize: '1.5rem' }}>📅</span>
        <span><strong>Informe diario</strong><div className="muted small">En espera</div></span>
      </div>
      <div className="card tight" style={{ display: 'flex', gap: '.7rem', alignItems: 'center', opacity: 0.55 }}>
        <span style={{ fontSize: '1.5rem' }}>📆</span>
        <span><strong>Informe mensual</strong><div className="muted small">En espera</div></span>
      </div>
    </div>
  )
}

/** Decimales con coma (38,2 °C). Solo en textos sin miles con punto. */
const es = (t: string) => t.replace(/(\d)\.(\d)/g, '$1,$2')
const TAG: Record<Light, string> = { verde: 'verde', amarillo: 'ambar', rojo: 'rojo', gris: 'gray' }
const SEMAFORO: Record<Light, string> = { verde: 'En rango', amarillo: 'Vigilar', rojo: 'Avisar', gris: 'Sin datos' }

function Semanal() {
  const params = useParams()
  const nav = useNavigate()
  const today = todayStr()
  const ws = params.date ? weekStart(params.date) : weekStart(today)
  const data: WeeklyData = {
    logs: useRows('daily_logs'),
    cycles: useRows('cycles'),
    products: useRows('products'),
    intakes: useRows('intakes'),
    weights: useRows('weights'),
    sessions: useRows('exercise_sessions'),
    diagnoses: useRows('diagnoses'),
    patient: useRows('patients')[0],
  }
  const r = useMemo(() => buildWeekly(ws, data, today), [ws, data.logs, data.cycles, data.products, data.intakes, data.weights, data.sessions, data.diagnoses, data.patient, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => buildWeekly(addDays(ws, -7), data, today), [ws, data.logs, data.cycles, data.products, data.intakes, data.weights, data.sessions, data.diagnoses, data.patient, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sent, setSent] = useState<Record<number, boolean>>({})
  const arrow = (b: Bloque) => {
    const p = prev.blocks.find((x) => x.key === b.key)
    if (b.pct == null || p?.pct == null) return ''
    return b.pct > p.pct ? ' ↑' : b.pct < p.pct ? ' ↓' : ' ='
  }
  const enCurso = r.weekEnd >= today
  const h = r.header

  const aPreguntas = async (i: number, text: string, date: string) => {
    await save('questions', { patient_id: currentPatientId(), professional: 'Oncología tradicional', question: `${text} (${fmtDate(date)}). ¿Qué hacemos?`, status: 'pendiente' } as never)
    setSent((s) => ({ ...s, [i]: true }))
  }

  return (
    <div className="informe">
      <div className="row between noprint">
        <Link to="/informes" className="small">← Evaluaciones</Link>
        <button className="btn sm" onClick={() => window.print()}>⬇️ Descargar PDF</button>
      </div>
      <h1>Informe semanal</h1>
      <div className="row between noprint" style={{ marginBottom: '.6rem' }}>
        <button className="btn sm ghost" onClick={() => nav(`/informes/semanal/${addDays(ws, -7)}`)}>‹</button>
        <div style={{ textAlign: 'center' }}><strong>{fmtDate(r.weekStart)} – {fmtDate(r.weekEnd)}</strong>{enCurso && <div className="muted small">semana en curso · {r.days.length} de 7 días</div>}</div>
        <button className="btn sm ghost" disabled={enCurso} onClick={() => nav(`/informes/semanal/${addDays(ws, 7)}`)}>›</button>
      </div>

      <div className="card tight">
        <div className="printonly"><strong>Huma · Informe semanal · {initials(data.patient?.name)}</strong> · {fmtDate(r.weekStart)} – {fmtDate(r.weekEnd)}</div>
        <div className="small">
          {[h.protocolo, h.ciclo, h.farmacos && `Fármacos de la semana: ${h.farmacos}`].filter(Boolean).join(' · ') || 'Sin ciclo'}
        </div>
        <div className="small">🏠 {h.casa} días en casa · 🏥 {h.hospital} en el hospital · {h.quimio} días de quimio · {h.nadir} de nadir</div>
        <div className="small">Registro diario completado: <strong>{h.registro ?? '—'} %</strong> · {h.diasApuntados} de {r.days.length} días apuntados</div>
      </div>

      {r.alerts.length > 0 && (
        <div className="card tight" style={{ borderColor: 'var(--rojo, #b1412f)' }}>
          <h3 style={{ marginTop: 0 }}>🚨 Alertas de la semana</h3>
          {r.alerts.map((a, i) => (
            <div key={i} className="item">
              <div className="main"><strong>{dayLabel(a.date)}</strong> · {es(a.text)} <span className="muted small">({a.block})</span></div>
              <button className="btn sm ghost noprint" disabled={sent[i]} onClick={() => aPreguntas(i, a.text, a.date)}>{sent[i] ? 'En Preguntas ✓' : '→ Preguntas'}</button>
            </div>
          ))}
        </div>
      )}

      <div className="card tight">
        <h3 style={{ marginTop: 0 }}>Resumen</h3>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {r.blocks.map((b) => (
                <tr key={b.key}>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); document.getElementById(`b-${b.key}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{b.ico} {b.title}</a></td>
                  <td><span className={'tag ' + TAG[b.light]}>{b.grade ?? SEMAFORO[b.light]}{arrow(b)}</span></td>
                  <td className="small">{b.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.mejorar.length > 0 && (<><div className="small" style={{ marginTop: '.5rem' }}><strong>A mejorar la semana que viene</strong></div><ol className="small">{r.mejorar.map((m, i) => <li key={i}>{es(m)}</li>)}</ol></>)}
        {r.mantener.length > 0 && (<><div className="small"><strong>Mantener</strong></div><ol className="small">{r.mantener.map((m, i) => <li key={i}>{m}</li>)}</ol></>)}
        <p className="muted small">Notas: insuficiente &lt; 60 % · suficiente 60–79 % · bueno 80–94 % · excelente ≥ 95 %. Con menos de 4 días apuntados: «datos insuficientes». ↑ ↓ = frente a la semana anterior.</p>
      </div>

      {r.blocks.map((b) => <BloqueCard key={b.key} b={b} />)}

      <p className="muted small">Huma registra y organiza; no da indicaciones médicas. Rangos de constantes aceptados el 27/09/2026; objetivos de líquidos pendientes de la nutricionista.</p>
    </div>
  )
}

function BloqueCard({ b }: { b: Bloque }) {
  return (
    <div className="card tight bloque" id={`b-${b.key}`}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{b.ico} {b.title}</h3>
        <span className={'tag ' + TAG[b.light]}>{b.grade ?? SEMAFORO[b.light]}{b.pct != null ? ` · ${b.pct} %` : ''}</span>
      </div>
      <div className="small muted" style={{ marginBottom: '.3rem' }}>{b.summary}</div>
      {b.indicators.map((i, k) => (
        <div key={k} className="item" style={{ alignItems: 'flex-start' }}>
          <span className={'dot ' + (i.light && i.light !== 'gris' ? i.light : 'verde')} style={{ marginTop: '.35rem', flex: '0 0 auto', visibility: i.light && i.light !== 'gris' ? 'visible' : 'hidden' }} />
          <div className="main">
            <div className="small"><strong>{i.label}:</strong> {es(i.value)}</div>
            {i.note && <div className="meta">{i.note}</div>}
          </div>
        </div>
      ))}
      {b.table && (
        <div className="table-wrap" style={{ marginTop: '.4rem' }}>
          <table className="table small">
            <thead><tr>{b.table.head.map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{b.table.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {b.advice.length > 0 && <div className="notice small" style={{ marginTop: '.5rem' }}>{b.advice.map((a, i) => <div key={i}>{es(a)}</div>)}</div>}
      {b.complications && b.complications.length > 0 && (
        <div className="small" style={{ marginTop: '.4rem' }}>
          <strong>Complicaciones de salud de la semana</strong>
          <ul>{b.complications.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
