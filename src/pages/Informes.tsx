import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { currentPatientId, save, useRows } from '../store'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { buildWeekly, dayLabel, type Bloque, type Light, type WeeklyData } from '../domain/weekly'
import { initials } from '../domain/exporter'
import { RegistroCard } from '../components/RegistroCard'
import { CuadroMandos } from '../components/CuadroMandos'
import { SuenoSemana } from '../components/SuenoSemana'
import { Section } from '../components/ui'
import { resumenesRecientes } from '../domain/nausea'

/** Pilar 📊 Evaluaciones (antes «Informes», renombrado el 28/09/2026): cómo se rellena el registro,
 *  el informe semanal y, en espera, el diario y el mensual. La ruta sigue siendo /informes. */
export default function Informes() {
  const { kind } = useParams()
  if (kind === 'semanal') return <Semanal />
  return <Portada />
}

/** Portada de Evaluaciones: registro, cuadro de mandos y sueño de la semana, e informes. */
function Portada() {
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const [lunes, setLunes] = useState(weekStart(todayStr()))
  const esEsta = lunes === weekStart(todayStr())
  const patient = useRows('patients')[0]
  // Náuseas por sesión de quimio (0.25.0): hasta el domingo de la semana que se ve (o hoy).
  const hasta = esEsta ? todayStr() : addDays(lunes, 6)
  const nauseas = resumenesRecientes(patient?.protocol_start, cycles, logs, hasta, 3)
  return (
    <div>
      <h1>📊 Evaluaciones</h1>
      <p className="muted small">Se calculan solos con lo que se apunta cada día. No hay que rellenar nada más.</p>
      <RegistroCard />
      <div className="eval-semana">
        <button type="button" className="btn sm secondary" aria-label="Semana anterior" onClick={() => setLunes(addDays(lunes, -7))}>‹</button>
        <strong>{esEsta ? 'Esta semana' : `Semana del ${fmtDate(lunes)}`}</strong>
        <button type="button" className="btn sm secondary" aria-label="Semana siguiente" disabled={esEsta} onClick={() => setLunes(addDays(lunes, 7))}>›</button>
      </div>
      <Section title="Cuadro de mandos de la semana" open>
        <CuadroMandos lunes={lunes} logs={logs} cycles={cycles} />
      </Section>
      <Section title="Náuseas y pauta antiemética" open>
        <p className="muted small">Por cada quimio: días con control completo (sin vómitos, sin arcadas, sin rescate y náusea de 2 o menos) en la fase aguda (perfusión y primeras 24 h) y en la retardada (días 2 a 5 tras terminar). Si la retardada no se controla, es el dato para comentar con oncología.</p>
        {nauseas.length === 0 && <div className="muted small">Todavía no hay sesiones de quimio con días apuntados.</div>}
        {nauseas.map((r) => {
          const nivel = (f: { dias: number; completos: number }) => (!f.dias ? '' : f.completos === f.dias ? 'ok' : f.completos >= f.dias / 2 ? 'ambar' : 'rojo')
          return (
            <div key={r.sesion} className="nausea-sesion">
              <strong>{r.titulo}</strong>
              <div className="nausea-fases">
                <span className={'cuadro-c ' + nivel(r.aguda)}>Aguda {r.aguda.dias ? `${r.aguda.completos}/${r.aguda.dias}` : '—'}</span>
                <span className={'cuadro-c ' + nivel(r.retardada)}>Retardada {r.retardada.dias ? `${r.retardada.completos}/${r.retardada.dias}` : '—'}</span>
                <span className="cuadro-c">{r.rescates ? `${r.rescates} rescate${r.rescates > 1 ? 's' : ''} · ${r.eficaces} ${r.eficaces === 1 ? 'eficaz' : 'eficaces'}` : 'Sin rescates'}</span>
                {r.anticipatoria && <span className="cuadro-c ambar">Anticipatoria</span>}
              </div>
            </div>
          )
        })}
      </Section>
      <Section title="Sueño y ritmo circadiano de la semana" open>
        <SuenoSemana lunes={lunes} logs={logs} />
      </Section>
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
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const arrow = (b: Bloque) => {
    const p = prev.blocks.find((x) => x.key === b.key)
    if (b.pct == null || p?.pct == null) return ''
    return b.pct > p.pct ? ' ↑' : b.pct < p.pct ? ' ↓' : ' ='
  }
  const enCurso = r.weekEnd >= today
  const h = r.header

  const aPreguntas = async (i: number | string, text: string, date?: string) => {
    await save('questions', { patient_id: currentPatientId(), professional: 'Oncología tradicional', question: date ? `${text} (${fmtDate(date)}). ¿Qué hacemos?` : `${text} (semana del ${fmtDate(r.weekStart)})`, status: 'pendiente' } as never)
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
        <div className="small">🏠 {h.casa} días en casa · 🏥 {h.hospital} en el hospital</div>
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
        {r.mantener.length > 0 && (<><div className="small" style={{ marginTop: '.5rem' }}><strong>Mantener</strong></div><ol className="small">{r.mantener.map((m, i) => <li key={i}>{m}</li>)}</ol></>)}
        <p className="muted small">Notas: insuficiente &lt; 60 % · suficiente 60–79 % · bueno 80–94 % · excelente ≥ 95 %. Con menos de 4 días apuntados: «datos insuficientes». ↑ ↓ = frente a la semana anterior.</p>
      </div>

      {r.acciones.length > 0 && (
        <div className="card tight">
          <h3 style={{ marginTop: 0 }}>✅ Qué hacer la semana que viene</h3>
          {r.acciones.map((a) => (
            <div key={a.title} style={{ marginBottom: '.5rem' }}>
              <div className="small"><strong>{a.ico} {a.title}</strong> <span className="muted">({a.grade})</span></div>
              <ul className="small informe-lista">{a.items.map((x, i) => <li key={i}>{es(x)}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {r.ojo.length > 0 && (
        <div className="card tight">
          <h3 style={{ marginTop: 0 }}>👀 OJO</h3>
          {r.ojo.map((o, i) => (
            <div key={i} className="item" style={{ alignItems: 'flex-start' }}>
              <span className={'dot ' + (o.light === 'gris' ? 'verde' : o.light)} style={{ marginTop: '.35rem', flex: '0 0 auto' }} />
              <div className="main">
                <div className="small"><strong>{o.title}.</strong> {es(o.text)}</div>
                {o.pregunta && <button className="btn sm ghost noprint" style={{ marginTop: '.3rem' }} disabled={sent['ojo' + i]} onClick={() => aPreguntas('ojo' + i, o.pregunta!)}>{sent['ojo' + i] ? 'En Preguntas ✓' : '→ Preguntas'}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

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
      {b.sections?.map((sec) => (
        <div key={sec.title} className="small" style={{ marginTop: '.5rem' }}>
          <strong>{sec.title}</strong>
          <ul className="informe-lista">{sec.lines.map((x, i) => <li key={i}>{es(x)}</li>)}</ul>
        </div>
      ))}
      {b.advice.length > 0 && <div className="notice small informe-notice">{b.advice.map((a, i) => <div key={i}>{es(a)}</div>)}</div>}
      {b.complications && b.complications.length > 0 && (
        <div className="small" style={{ marginTop: '.4rem' }}>
          <strong>Complicaciones de salud de la semana</strong>
          <ul>{b.complications.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
