import { useState } from 'react'
import { Link } from 'react-router-dom'
import { currentPatientId, faltaTabla, remove, save, useRows } from '../store'
import { GUIDELINE_SOURCES, PROFESSIONALS, type Guideline, type GuidelineSource, type Professional, type Question } from '../store/types'
import { todayStr } from '../domain/dates'
import { confirmar } from '../components/Confirmar'

/** 0.31.0 · Pautas y aprendizajes: arriba los especialistas (como en «Preguntas al equipo») y debajo,
 *  para cada uno, un documento que va creciendo, como una hoja de Word:
 *  - las respuestas a nuestras preguntas entran solas desde «Preguntas al equipo» (no se apuntan dos veces);
 *  - lo que escribimos nosotros (email, sesión privada, consulta, mensaje…) se añade al final. */

/** Un párrafo del documento: algo escrito aquí o una pregunta ya respondida. */
type Entrada =
  | { tipo: 'pauta'; id: string; date: string; orden: string; professional: Professional; g: Guideline }
  | { tipo: 'respuesta'; id: string; date: string; orden: string; professional: Professional; q: Question }

export function fmtCorta(s?: string | null) {
  if (!s) return 'sin fecha'
  const d = new Date(s.length <= 10 ? s + 'T12:00:00' : s)
  const mismoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(mismoAno ? {} : { year: 'numeric' }) })
}
const fmtLarga = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

/** Todo el documento, en orden de fecha (lo más antiguo arriba, lo nuevo se añade al final). */
function juntar(guidelines: Guideline[], questions: Question[]): Entrada[] {
  return [
    ...guidelines.map((g) => ({ tipo: 'pauta' as const, id: g.id, date: g.date, orden: g.created_at, professional: g.professional, g })),
    ...questions.map((q) => ({ tipo: 'respuesta' as const, id: q.id, date: q.answered_at ?? q.updated_at.slice(0, 10), orden: q.updated_at, professional: q.professional, q })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.orden.localeCompare(b.orden))
}

/** Lo vigente (pautas que se aplican + preguntas respondidas), lo más reciente primero. Lo usa la lista de Seguimiento. */
export function entradasVigentes(guidelines: Guideline[], questions: Question[]): Entrada[] {
  return juntar(guidelines.filter((g) => g.active !== false), questions.filter((q) => q.status === 'respondida')).reverse()
}

/** El texto completo de una pauta. Se guarda la primera línea como «title» (para los informes) y el resto como «detail». */
const textoDe = (g: Guideline) => (g.detail ? `${g.title}\n${g.detail}` : g.title)
function partir(texto: string): { title: string; detail?: string } {
  const t = texto.trim()
  const i = t.indexOf('\n')
  if (i < 0) return { title: t }
  return { title: t.slice(0, i).trim(), detail: t.slice(i + 1).trim() || undefined }
}

/** Para buscar sin que importen mayúsculas ni tildes («Nutrición» = «nutricion»). */
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const palabrasDe = (b: string) => sinTildes(b).split(/\s+/).filter((w) => w.length > 0)
function textoBuscable(e: Entrada): string {
  if (e.tipo === 'respuesta') return sinTildes(`${e.q.question} ${e.q.answer ?? ''} ${e.q.pillar ?? ''}`)
  const src = GUIDELINE_SOURCES.find((s) => s.key === e.g.source)?.label ?? ''
  return sinTildes(`${textoDe(e.g)} ${e.g.who ?? ''} ${src} ${e.g.pillar ?? ''}`)
}

/** Pinta el texto con las palabras buscadas resaltadas (sin importar tildes ni mayúsculas). */
function Resaltado({ texto, palabras }: { texto: string; palabras?: string[] }) {
  if (!palabras?.length || !texto) return <>{texto}</>
  // Versión sin tildes letra a letra, para que las posiciones coincidan con el texto original.
  const letras = [...texto]
  const norm = letras.map((c) => sinTildes(c) || c)
  const plano = norm.join('')
  const inicio: number[] = []
  let pos = 0
  for (const n of norm) { inicio.push(pos); pos += n.length }
  const marca = new Array(letras.length).fill(false)
  for (const w of palabras) {
    let i = plano.indexOf(w)
    while (i >= 0) {
      for (let k = 0; k < letras.length; k++) if (inicio[k] >= i && inicio[k] < i + w.length) marca[k] = true
      i = plano.indexOf(w, i + w.length)
    }
  }
  const trozos: { t: string; m: boolean }[] = []
  letras.forEach((c, k) => {
    const ult = trozos[trozos.length - 1]
    if (ult && ult.m === marca[k]) ult.t += c
    else trozos.push({ t: c, m: marca[k] })
  })
  return <>{trozos.map((x, i) => (x.m ? <mark key={i}>{x.t}</mark> : <span key={i}>{x.t}</span>))}</>
}

export default function Pautas() {
  const guidelines = useRows('guidelines')
  const questions = useRows('questions', (q) => q.status === 'respondida')
  const todo = juntar(guidelines, questions)
  // Se abre en el especialista con lo último apuntado; si no hay nada, en el primero, como en Preguntas.
  const [prof, setProf] = useState<Professional>(() => todo[todo.length - 1]?.professional ?? PROFESSIONALS[0])
  const falta = faltaTabla('guidelines')
  const [buscar, setBuscar] = useState('')
  const palabras = palabrasDe(buscar)
  const buscando = palabras.length > 0
  // Al buscar se mira en los documentos de todos los especialistas: muchas veces no se recuerda quién lo dijo.
  const encontrados = buscando ? todo.filter((e) => { const t = textoBuscable(e); return palabras.every((w) => t.includes(w)) }) : []
  const nEsp = new Set(encontrados.map((e) => e.professional)).size
  const abrir = (p: Professional) => { setProf(p); setBuscar(''); window.scrollTo(0, 0) }
  const doc = todo.filter((e) => e.professional === prof)
  const ultima = doc[doc.length - 1]
  // Para no tener que escribir cada vez quién lo dijo: se propone el último nombre usado con este especialista.
  const ultimoNombre = doc.flatMap((e) => (e.tipo === 'pauta' && e.g.who ? [e.g.who] : [])).pop()

  return (
    <div>
      <div className="row between noprint">
        <h1>Pautas y aprendizajes</h1>
        {doc.length > 0 && !buscando && <button className="btn sm secondary" onClick={() => window.print()}>🖨 Imprimir / PDF</button>}
      </div>
      <div className="buscador noprint">
        <input type="search" placeholder="🔍 Buscar una palabra (ayuno, batido…)" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar en todos los documentos" />
        {buscar && <button type="button" className="buscador-borrar" onClick={() => setBuscar('')} aria-label="Borrar la búsqueda">✕</button>}
      </div>

      {buscando ? (
        <article className="hoja">
          <header className="hoja-cabecera">
            <h2>Buscando «{buscar.trim()}»</h2>
            <div className="muted small">
              {encontrados.length
                ? `${encontrados.length} resultado${encontrados.length > 1 ? 's' : ''} en ${nEsp} especialista${nEsp > 1 ? 's' : ''} · toca uno para abrir su documento`
                : 'No aparece en ningún documento. Prueba con otra palabra o con una parte de ella (p. ej. «vitam»).'}
            </div>
          </header>
          {encontrados.map((e) => <Parrafo key={e.tipo + e.id} e={e} palabras={palabras} onAbrir={() => abrir(e.professional)} />)}
        </article>
      ) : (<>
      <div className="chips noprint" style={{ marginBottom: '.8rem' }}>
        {PROFESSIONALS.map((p) => {
          const n = todo.filter((e) => e.professional === p).length
          return <button key={p} type="button" className={'chip ' + (prof === p ? 'on' : '')} onClick={() => setProf(p)}>{p}{n ? ` (${n})` : ''}</button>
        })}
      </div>

      <article className="hoja">
        <header className="hoja-cabecera">
          <h2>{prof}</h2>
          <div className="muted small">
            {doc.length
              ? `Lo que nos ha dicho · ${doc.length} entrada${doc.length > 1 ? 's' : ''} · última del ${fmtLarga(ultima.date)}`
              : 'Aquí se irá escribiendo lo que nos diga: las respuestas a nuestras preguntas y lo que apuntemos de emails y sesiones.'}
          </div>
        </header>

        {doc.map((e) => <Parrafo key={e.tipo + e.id} e={e} />)}

        {falta
          ? <div className="notice noprint" style={{ marginTop: '1rem' }}><strong>Falta un paso para poder escribir aquí.</strong> Hay que ejecutar una vez el archivo «migracion-v031-pautas.sql» en Supabase (SQL Editor). Mientras tanto se ven las respuestas de «Preguntas al equipo».</div>
          : <Escribir key={prof} prof={prof} ultimoNombre={ultimoNombre} />}
      </article>
      </>)}
      <style>{`@media print { .topbar, .tabbar, .noprint, .apartados { display: none !important } .content { padding: 0 } .hoja { box-shadow: none; border: none; padding: 0 } }`}</style>
    </div>
  )
}

/** Un párrafo del documento. En la búsqueda (`onAbrir`) lleva el especialista delante y las palabras resaltadas. */
function Parrafo({ e, palabras, onAbrir }: { e: Entrada; palabras?: string[]; onAbrir?: () => void }) {
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState(false)

  if (e.tipo === 'respuesta') {
    const q = e.q
    return (
      <section className="hoja-entrada">
        <div className="hoja-fecha" onClick={() => setOpen(!open)}>{onAbrir && <span className="hoja-esp">{q.professional} · </span>}{fmtLarga(e.date)} · 💬 Respuesta a nuestra pregunta</div>
        <div onClick={() => setOpen(!open)}>
          <p className="hoja-pregunta">«<Resaltado texto={q.question} palabras={palabras} />»</p>
          <p className="hoja-texto"><Resaltado texto={q.answer ?? ''} palabras={palabras} /></p>
        </div>
        {open && (
          <div className="row noprint" style={{ marginTop: '.3rem', gap: '.4rem', flexWrap: 'wrap' }}>
            {onAbrir && <button className="btn sm" onClick={onAbrir}>Abrir el documento de {q.professional}</button>}
            <Link className="btn sm secondary" to="/equipo">Modificar en Preguntas al equipo</Link>
          </div>
        )}
      </section>
    )
  }

  const g = e.g
  const src = GUIDELINE_SOURCES.find((s) => s.key === g.source)
  if (editando) return <section className="hoja-entrada"><Editor inicial={g} onClose={() => setEditando(false)} /></section>
  const archivada = g.active === false
  return (
    <section className={'hoja-entrada' + (archivada ? ' archivada' : '')}>
      <div className="hoja-fecha" onClick={() => setOpen(!open)}>
        {onAbrir && <span className="hoja-esp">{g.professional} · </span>}{fmtLarga(g.date)} · {src?.ico} {src?.label ?? g.source}{g.who ? ` · ${g.who}` : ''}{archivada ? ' · ya no se aplica' : ''}
      </div>
      <p className="hoja-texto" onClick={() => setOpen(!open)}><Resaltado texto={textoDe(g)} palabras={palabras} /></p>
      {open && (
        <div className="row noprint" style={{ marginTop: '.3rem', gap: '.4rem', flexWrap: 'wrap' }}>
          {onAbrir && <button className="btn sm" onClick={onAbrir}>Abrir el documento de {g.professional}</button>}
          <button className="btn sm secondary" onClick={() => { setEditando(true); setOpen(false) }}>✏️ Modificar</button>
          {archivada
            ? <button className="btn sm ghost" onClick={() => save('guidelines', { ...g, active: true })}>Vuelve a aplicarse</button>
            : <button className="btn sm ghost" onClick={() => save('guidelines', { ...g, active: false })}>Ya no se aplica</button>}
          <button className="btn sm danger" onClick={async () => { if (await confirmar('¿Borrar este texto del documento?')) remove('guidelines', g.id) }}>Borrar</button>
        </div>
      )}
    </section>
  )
}

/** El hueco para escribir al final del documento. */
function Escribir({ prof, ultimoNombre }: { prof: Professional; ultimoNombre?: string }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) return (
    <button type="button" className="hoja-escribir noprint" onClick={() => setAbierto(true)}>✏️ Escribir algo nuevo de {prof}…</button>
  )
  return (
    <div className="hoja-entrada noprint">
      <Editor inicial={{ professional: prof, date: todayStr(), source: 'email', who: ultimoNombre, active: true }} onClose={() => setAbierto(false)} />
    </div>
  )
}

function Editor({ inicial, onClose }: { inicial: Partial<Guideline>; onClose: () => void }) {
  const [source, setSource] = useState<GuidelineSource>(inicial.source ?? 'email')
  const [date, setDate] = useState(inicial.date ?? todayStr())
  const [who, setWho] = useState(inicial.who ?? '')
  const [texto, setTexto] = useState(inicial.title ? textoDe(inicial as Guideline) : '')
  const guardar = async () => {
    await save('guidelines', {
      ...inicial,
      patient_id: inicial.patient_id ?? currentPatientId(),
      professional: inicial.professional,
      date, source, who: who.trim() || undefined,
      ...partir(texto),
      active: inicial.active !== false,
    } as Partial<Guideline>)
    onClose()
  }
  return (
    <div className="hoja-editor">
      <div className="chips" style={{ marginBottom: '.5rem' }}>
        {GUIDELINE_SOURCES.map((s) => (
          <button key={s.key} type="button" className={'chip ' + (source === s.key ? 'on' : '')} onClick={() => setSource(s.key)}>{s.ico} {s.label}</button>
        ))}
      </div>
      <div className="row" style={{ gap: '.4rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
        <input type="date" aria-label="Fecha" style={{ width: 'auto' }} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="text" aria-label="Quién lo dijo" placeholder="Quién (opcional): Sofía, Dra. García…" value={who} onChange={(e) => setWho(e.target.value)} style={{ flex: '1 1 10rem' }} />
      </div>
      <textarea
        autoFocus
        className="hoja-textarea"
        placeholder="Escribe o pega aquí lo que os han dicho: el texto del email, lo que apuntasteis en la sesión…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="row" style={{ marginTop: '.4rem' }}>
        <button className="btn sm" disabled={!texto.trim() || !date} onClick={guardar}>{inicial.id ? 'Guardar cambios' : 'Añadir al documento'}</button>
        <button className="btn sm ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
