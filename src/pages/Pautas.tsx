import { useState } from 'react'
import { Link } from 'react-router-dom'
import { currentPatientId, faltaTabla, remove, save, useRows } from '../store'
import { GUIDELINE_SOURCES, PROFESSIONALS, type Guideline, type GuidelineSource, type Professional, type Question } from '../store/types'
import { PILLARS } from '../domain/catalogs'
import { todayStr } from '../domain/dates'
import { Field, Section } from '../components/ui'
import { confirmar } from '../components/Confirmar'

/** 0.31.0 · Pautas y aprendizajes: todo lo que nos dicen los profesionales en un mismo sitio.
 *  - Las respuestas a nuestras preguntas salen solas de «Preguntas al equipo» (no se apuntan dos veces).
 *  - Lo que llega por email, en una sesión privada, en consulta o por mensaje se apunta aquí. */

/** Una entrada de la lista: una pauta apuntada aquí o una pregunta ya respondida. */
type Entrada =
  | { tipo: 'pauta'; id: string; date: string; professional: Professional; g: Guideline }
  | { tipo: 'respuesta'; id: string; date: string; professional: Professional; q: Question }

const ORIGENES = [
  { key: '', label: 'De cualquier origen' },
  { key: 'respuesta', label: '💬 Respuestas a preguntas' },
  ...GUIDELINE_SOURCES.map((s) => ({ key: s.key, label: `${s.ico} ${s.label}` })),
]

export function fmtCorta(s?: string | null) {
  if (!s) return 'sin fecha'
  const d = new Date(s.length <= 10 ? s + 'T12:00:00' : s)
  const mismoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(mismoAno ? {} : { year: 'numeric' }) })
}

/** Las entradas vigentes (pautas activas + preguntas respondidas), de la más reciente a la más antigua. */
export function entradasVigentes(guidelines: Guideline[], questions: Question[]): Entrada[] {
  return juntar(guidelines.filter((g) => g.active !== false), questions.filter((q) => q.status === 'respondida'))
}
function juntar(guidelines: Guideline[], questions: Question[]): Entrada[] {
  return [
    ...guidelines.map((g) => ({ tipo: 'pauta' as const, id: g.id, date: g.date, professional: g.professional, g })),
    ...questions.map((q) => ({ tipo: 'respuesta' as const, id: q.id, date: q.answered_at ?? q.updated_at.slice(0, 10), professional: q.professional, q })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.tipo === 'pauta' ? b.g.created_at : b.q.updated_at).localeCompare(a.tipo === 'pauta' ? a.g.created_at : a.q.updated_at))
}

export default function Pautas() {
  const guidelines = useRows('guidelines')
  const questions = useRows('questions', (q) => q.status === 'respondida')
  const [editing, setEditing] = useState<Partial<Guideline> | null>(null)
  const [prof, setProf] = useState<Professional | ''>('')
  const [origen, setOrigen] = useState('')
  const [buscar, setBuscar] = useState('')
  const falta = faltaTabla('guidelines')

  if (editing) return <PautaForm initial={editing} onClose={() => setEditing(null)} />

  const texto = (e: Entrada) => (e.tipo === 'pauta' ? `${e.g.title} ${e.g.detail ?? ''} ${e.g.who ?? ''} ${e.g.pillar ?? ''}` : `${e.q.question} ${e.q.answer ?? ''} ${e.q.pillar ?? ''}`).toLowerCase()
  const pasa = (e: Entrada) =>
    (!prof || e.professional === prof) &&
    (!origen || (origen === 'respuesta' ? e.tipo === 'respuesta' : e.tipo === 'pauta' && e.g.source === origen)) &&
    (!buscar.trim() || buscar.toLowerCase().trim().split(/\s+/).every((w) => texto(e).includes(w)))

  const vigentes = entradasVigentes(guidelines, questions)
  const lista = vigentes.filter(pasa)
  const archivadas = juntar(guidelines.filter((g) => g.active === false), []).filter(pasa)
  const nuevo = () => setEditing({ date: todayStr(), professional: prof || PROFESSIONALS[0], source: 'email', active: true })

  return (
    <div>
      <div className="row between">
        <h1>Pautas y aprendizajes</h1>
        <button className="btn sm" disabled={falta} onClick={nuevo}>+ Nueva pauta</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Lo que nos dicen los profesionales, en un solo sitio: las respuestas a nuestras preguntas, los emails, las sesiones privadas y las consultas.
      </p>
      {falta && (
        <div className="notice">
          <strong>Falta un paso para poder apuntar pautas.</strong> Hay que ejecutar una vez el archivo «migracion-v031-pautas.sql» en Supabase (SQL Editor). Mientras tanto se ven aquí las respuestas de «Preguntas al equipo».
        </div>
      )}

      <div className="chips" style={{ marginBottom: '.5rem' }}>
        <button type="button" className={'chip ' + (prof === '' ? 'on' : '')} onClick={() => setProf('')}>Todos ({vigentes.length})</button>
        {PROFESSIONALS.map((p) => {
          const n = vigentes.filter((e) => e.professional === p).length
          if (!n && prof !== p) return null
          return <button key={p} type="button" className={'chip ' + (prof === p ? 'on' : '')} onClick={() => setProf(p)}>{p} ({n})</button>
        })}
      </div>
      <div className="row" style={{ gap: '.4rem', marginBottom: '.7rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar (p. ej. batido, ayuno, ginseng)" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ flex: '1 1 12rem' }} />
        <select style={{ width: 'auto', flex: '0 1 auto' }} value={origen} onChange={(e) => setOrigen(e.target.value)}>
          {ORIGENES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {lista.length === 0 && (
        <div className="empty">
          {vigentes.length === 0
            ? <>Todavía no hay nada. Apunta aquí la próxima pauta que os den por email o en una sesión, o responde una pregunta en <Link to="/equipo">Preguntas al equipo</Link>.</>
            : 'Nada con ese filtro.'}
        </div>
      )}
      {lista.map((e) => <EntradaItem key={e.tipo + e.id} e={e} onEdit={setEditing} />)}

      {archivadas.length > 0 && (
        <Section title={`Ya no se aplican (${archivadas.length})`}>
          <p className="muted small" style={{ marginTop: 0 }}>Pautas que se sustituyeron por otras o que ya terminaron. Se guardan para saber qué se hizo y cuándo.</p>
          {archivadas.map((e) => <EntradaItem key={e.tipo + e.id} e={e} onEdit={setEditing} />)}
        </Section>
      )}
    </div>
  )
}

function EntradaItem({ e, onEdit }: { e: Entrada; onEdit: (g: Guideline) => void }) {
  const [open, setOpen] = useState(false)
  if (e.tipo === 'respuesta') {
    const q = e.q
    return (
      <div className="card tight pauta-item" style={{ marginBottom: '.4rem' }}>
        <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
          <div className="pauta-meta">
            <span className="tag">💬 Respuesta</span>
            {q.pillar && <span className="tag gray">{q.pillar}</span>}
            <span className="muted small">{fmtCorta(e.date)} · {q.professional}</span>
          </div>
          <div className="pauta-pregunta">«{q.question}»</div>
          <div className={'pauta-texto' + (open ? '' : ' corto')}>{q.answer}</div>
        </div>
        {open && (
          <div className="row" style={{ marginTop: '.4rem' }}>
            <Link className="btn sm secondary" to="/equipo">Ver en Preguntas al equipo</Link>
          </div>
        )}
      </div>
    )
  }
  const g = e.g
  const src = GUIDELINE_SOURCES.find((s) => s.key === g.source)
  return (
    <div className={'card tight pauta-item' + (g.active === false ? ' archivada' : '')} style={{ marginBottom: '.4rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div className="pauta-meta">
          <span className="tag">{src?.ico} {src?.label ?? g.source}</span>
          {g.pillar && <span className="tag gray">{g.pillar}</span>}
          <span className="muted small">{fmtCorta(g.date)} · {g.who ? `${g.who} (${g.professional})` : g.professional}</span>
        </div>
        <strong className="pauta-titulo">{g.title}</strong>
        {g.detail && <div className={'pauta-texto' + (open ? '' : ' corto')}>{g.detail}</div>}
      </div>
      {open && (
        <div className="row" style={{ marginTop: '.4rem', gap: '.4rem', flexWrap: 'wrap' }}>
          <button className="btn sm secondary" onClick={() => onEdit(g)}>✏️ Modificar</button>
          {g.active === false
            ? <button className="btn sm ghost" onClick={() => save('guidelines', { ...g, active: true })}>Vuelve a aplicarse</button>
            : <button className="btn sm ghost" onClick={() => save('guidelines', { ...g, active: false })}>Ya no se aplica</button>}
          <button className="btn sm danger" onClick={async () => { if (await confirmar('¿Borrar esta pauta?')) remove('guidelines', g.id) }}>Borrar</button>
        </div>
      )}
    </div>
  )
}

function PautaForm({ initial, onClose }: { initial: Partial<Guideline>; onClose: () => void }) {
  const [g, setG] = useState<Partial<Guideline>>(initial)
  const set = (patch: Partial<Guideline>) => setG((x) => ({ ...x, ...patch }))
  const ok = !!g.title?.trim() && !!g.date && !!g.professional && !!g.source
  const guardar = async () => {
    await save('guidelines', {
      ...g,
      patient_id: g.patient_id ?? currentPatientId(),
      title: g.title!.trim(),
      detail: g.detail?.trim() || undefined,
      who: g.who?.trim() || undefined,
      pillar: g.pillar || undefined,
      active: g.active !== false,
    } as Partial<Guideline>)
    onClose()
  }
  return (
    <div>
      <h1>{initial.id ? 'Modificar pauta' : 'Nueva pauta'}</h1>
      <div className="card">
        <div className="field">
          <span>¿De dónde viene?</span>
          <div className="chips">
            {GUIDELINE_SOURCES.map((s) => (
              <button key={s.key} type="button" className={'chip ' + (g.source === s.key ? 'on' : '')} onClick={() => set({ source: s.key as GuidelineSource })}>{s.ico} {s.label}</button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <Field label="Fecha"><input type="date" value={g.date ?? ''} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Profesional">
            <select value={g.professional ?? ''} onChange={(e) => set({ professional: e.target.value as Professional })}>
              {PROFESSIONALS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Nombre (opcional)"><input type="text" placeholder="p. ej. Sofía, Dra. García" value={g.who ?? ''} onChange={(e) => set({ who: e.target.value })} /></Field>
        <Field label="La pauta en una frase" hint="Qué hay que hacer, para encontrarla rápido. Ej.: «El batido de la tarde cuenta como líquido».">
          <input type="text" value={g.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Detalle (opcional)" hint="Puedes pegar aquí el texto del email o lo que apuntasteis en la sesión.">
          <textarea style={{ minHeight: '9rem' }} value={g.detail ?? ''} onChange={(e) => set({ detail: e.target.value })} />
        </Field>
        <Field label="Pilar (opcional)">
          <select value={g.pillar ?? ''} onChange={(e) => set({ pillar: e.target.value })}>
            <option value="">—</option>
            {PILLARS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <div className="row" style={{ marginTop: '.5rem' }}>
          <button className="btn" disabled={!ok} onClick={guardar}>Guardar</button>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
