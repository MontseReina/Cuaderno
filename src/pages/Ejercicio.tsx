import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { backend, currentPatientId, remove, save, useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import type { DailyLog, ExerciseItem, ExerciseSerie, ExerciseSession, FunctionalDaily } from '../store/types'
import { conResumen, resumenEjercicio } from '../domain/ejercicio'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { Segmented, Section } from '../components/ui'
import { confirmar } from '../components/Confirmar'
import { faseTexto } from '../domain/diaTratamiento'
import { EFFORT_FACES, WALK_AID, WALK_STOP } from '../domain/catalogs'
import { MANO_HORAS } from '../domain/avisos'

/** Aviso del tramo del día según el día real tras la última sesión de quimio. */
function tramo(phase: string, day: number | null, etiqueta?: string | null): string {
  const d = etiqueta ? `${etiqueta}: ` : ''
  if (phase === 'en_ciclo') return `${d}en ciclo. Movilización, levantarse, paseos cortos. Nada de encamamiento total.`
  if (phase === 'valle') return `${d}valle (D7-14). Actividad ligera, sin exigencia. Sin contacto ni frotar fuerte si hay trombopenia.`
  if (phase === 'recuperacion' && day != null && day >= 15) return `${d}ventana de mayor capacidad (D15-21). Buen momento para fuerza y aeróbico.`
  if (phase === 'recuperacion') return `${d}recuperándose de la quimio. Actividad suave y progresiva según cómo esté.`
  if (phase === 'previo') return 'Antes del ciclo: mantener rutina.'
  return ''
}

type Kind = 'fuerza' | 'aerobico'
type View =
  | { v: 'agenda' }
  | { v: 'fuerza' }
  | { v: 'ejercicio'; i: number | null }
  | { v: 'aerobico'; edit: string | 'nuevo' | null }
  | { v: 'paseo' }
  | { v: 'mano' }
  | { v: 'funcional' }
  | { v: 'otra' }
  | { v: 'no'; kind: Kind }

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MOTIVOS = ['Fiebre', 'Cansancio', 'Dolor', 'Náuseas o vómitos', 'Plaquetas o defensas bajas', 'En el hospital', 'No hubo tiempo']
const AEROBICOS = ['Bicicleta', 'Elíptica', 'Cinta', 'Nadar', 'Bailar', 'Patinete']
const OTRAS = [
  { key: 'juego', label: 'Juego activo' },
  { key: 'fisio', label: 'Fisioterapia' },
  { key: 'cama', label: 'Movilización en cama' },
]
const COMIDAS = [
  { k: 'desayuno', label: 'Desayuno' },
  { k: 'comida', label: 'Comida' },
  { k: 'cena', label: 'Cena' },
] as const

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Pilar 7 · Ejercicio, como una agenda: arriba la semana y, por día, una tarjeta por actividad.
 *  Lo que no se apunta cuenta como no realizado; «Hoy no se ha hecho» guarda el motivo. */
export default function Ejercicio() {
  const params = useParams()
  const [date, setDate] = useState(params.date ?? todayStr())
  const [view, setViewRaw] = useState<View>({ v: 'agenda' })
  const setView = (v: View) => { setViewRaw(v); window.scrollTo(0, 0) }
  useEffect(() => { if (params.date) setDate(params.date) }, [params.date])

  const all = useRows('exercise_sessions')
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const patient = backend.all('patients')[0]
  const { draft, set, setExtra, toastNode } = useDailyDraft(date)
  const del = all.filter((s) => s.date === date)
  const fuerzaHoy = del.filter((s) => s.kind === 'fuerza')
  const aeroHoy = del.filter((s) => s.kind === 'aerobico')
  const ctx = cycleContext(cycles, date)
  const aviso = tramo(ctx.phase, ctx.day, faseTexto(patient?.protocol_start, cycles, date))
  const limites = patient?.load_limits

  // Al apuntar una sesión: marca la actividad del día y quita el «no se ha hecho».
  const marcar = (kind: Kind, on: boolean) => {
    set('activity', { ...(draft.activity ?? {}), [kind]: on })
    if (on && draft.extra?.ex_no?.[kind]) { const n = { ...(draft.extra?.ex_no ?? {}) }; delete n[kind]; setExtra({ ex_no: n }) }
  }

  const props = { date, draft, set, setExtra, setView, limites }
  let body: ReactNode
  if (view.v === 'fuerza' || view.v === 'ejercicio') body = <Fuerza {...props} all={all} sesion={fuerzaHoy[0]} view={view} marcar={marcar} />
  else if (view.v === 'aerobico') body = <Aerobico {...props} all={all} sesiones={aeroHoy} edit={view.edit} marcar={marcar} />
  else if (view.v === 'paseo') body = <Paseo {...props} />
  else if (view.v === 'mano') body = <Mano {...props} />
  else if (view.v === 'funcional') body = <Funcional {...props} />
  else if (view.v === 'otra') body = <Otra {...props} />
  else if (view.v === 'no') body = <NoHecho {...props} kind={view.kind} />
  else body = <Agenda {...props} all={all} logs={logs} setDate={setDate} aviso={aviso} fuerza={fuerzaHoy} aero={aeroHoy} />
  return <div className="ej">{toastNode}{body}</div>
}

interface Comun {
  date: string
  draft: DailyLog
  set: <K extends keyof DailyLog>(k: K, v: DailyLog[K]) => void
  setExtra: (p: Partial<NonNullable<DailyLog['extra']>>) => void
  setView: (v: View) => void
  limites?: string | null
}

function Cabecera({ title, date, onBack, sub }: { title: string; date: string; onBack: () => void; sub?: string }) {
  return (
    <div className="ej-head">
      <button type="button" className="ej-back" aria-label="Volver" onClick={onBack}>←</button>
      <div className="ej-fecha">{date === todayStr() ? 'Hoy' : fmtDate(date)}</div>
      <h1>{title}</h1>
      {sub && <p className="muted small">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- Agenda
function Agenda({ date, draft, setView, all, logs, setDate, aviso, limites, fuerza, aero }: Comun & {
  all: ExerciseSession[]; logs: DailyLog[]; setDate: (d: string) => void; aviso: string; fuerza: ExerciseSession[]; aero: ExerciseSession[]
}) {
  const hoy = todayStr()
  const lunes = weekStart(date)
  const semana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  const logOf = (d: string) => (d === date ? draft : logs.find((l) => l.date === d))
  const puntos = (d: string) => {
    const s = all.filter((x) => x.date === d)
    const l = logOf(d)
    const mv = l?.extra?.move_after ?? {}
    return [
      s.some((x) => x.kind === 'fuerza') && 'fz',
      s.some((x) => x.kind === 'aerobico') && 'ae',
      (Object.values(mv).some(Boolean) || l?.extra?.functional?.walk_min || l?.steps) && 'pa',
      Object.values(l?.extra?.mano ?? {}).some(Boolean) && 'mn',
    ].filter(Boolean) as string[]
  }
  const ex = draft.extra ?? {}
  const no = ex.ex_no ?? {}
  const mv = ex.move_after ?? {}
  const nMv = COMIDAS.filter((c) => mv[c.k]).length
  const f = ex.functional ?? {}
  const nF = [f.stairs, f.stands_alone, f.falls].filter((x) => x !== undefined && x !== null && x !== '').length
  const otras = OTRAS.filter((o) => draft.activity?.[o.key])
  const nMano = MANO_HORAS.filter((h) => ex.mano?.[h]).length

  const ejercicios = fuerza.flatMap((s) => s.exercises)
  const fzMin = fuerza.reduce((a, s) => a + (s.minutes ?? 0), 0)
  const aeMin = aero.reduce((a, s) => a + (s.minutes ?? 0), 0)

  return (
    <div>
      <h1>Ejercicio</h1>
      <div className="ej-semana-nav">
        <button type="button" className="btn sm ghost" aria-label="Semana anterior" onClick={() => setDate(addDays(lunes, -7))}>‹</button>
        <strong>Semana del {fmtDate(lunes)}</strong>
        <button type="button" className="btn sm ghost" aria-label="Semana siguiente" disabled={addDays(lunes, 7) > hoy} onClick={() => setDate(addDays(lunes, 7) > hoy ? hoy : addDays(lunes, 7))}>›</button>
      </div>
      <div className="ej-semana">
        {semana.map((d, i) => (
          <button key={d} type="button" disabled={d > hoy} className={'ej-dia' + (d === date ? ' on' : '') + (d === hoy ? ' hoy' : '')} onClick={() => setDate(d)} aria-label={fmtDate(d)}>
            <span className="l">{DIAS[i]}</span>
            <span className="n">{Number(d.slice(8))}</span>
            <span className="pts">{puntos(d).map((p) => <i key={p} className={p} />)}</span>
          </button>
        ))}
      </div>
      <p className="muted small ej-leyenda"><i className="fz" /> fuerza <i className="ae" /> aeróbico <i className="pa" /> paseo <i className="mn" /> mano</p>

      {aviso && <div className="notice">{aviso}</div>}

      <Tarjeta ico="fz" title="Fuerza" onClick={() => setView({ v: 'fuerza' })}
        sub={ejercicios.length ? `${plural(ejercicios.length, 'ejercicio', 'ejercicios')}${fzMin ? ` · ${fzMin} min` : ''}` : no.fuerza ? `No se ha hecho · ${no.fuerza}` : 'Sin apuntar'}
        badge={ejercicios.length ? '✓' : no.fuerza ? '✗' : 'Falta'} ok={!!ejercicios.length} />
      <Tarjeta ico="ae" title="Aeróbico" onClick={() => setView({ v: 'aerobico', edit: aero.length ? null : 'nuevo' })}
        sub={aero.length ? `${aero.map((s) => s.exercises.map((e) => e.name).join(', ') || 'Aeróbico').join(' · ')}${aeMin ? ` · ${aeMin} min` : ''}` : no.aerobico ? `No se ha hecho · ${no.aerobico}` : 'Bici, elíptica, nadar… sin apuntar'}
        badge={aero.length ? '✓' : no.aerobico ? '✗' : 'Falta'} ok={!!aero.length} />
      <Tarjeta ico="pa" title="Paseo y movimiento" onClick={() => setView({ v: 'paseo' })}
        sub={[`Después de comer ${nMv}/3`, f.walk_min ? `paseo ${f.walk_min} min` : '', draft.steps ? `${draft.steps} pasos` : ''].filter(Boolean).join(' · ')}
        badge={nMv === 3 ? '✓' : `${nMv}/3`} ok={nMv === 3} />
      <Tarjeta ico="mn" title="Ejercicios de la mano" onClick={() => setView({ v: 'mano' })}
        sub={`Dedos y luego bola · ${nMano} de ${MANO_HORAS.length} rondas`} badge={`${nMano}/${MANO_HORAS.length}`} ok={nMano === MANO_HORAS.length} />
      <Tarjeta ico="cf" title="Capacidad funcional" onClick={() => setView({ v: 'funcional' })}
        sub={`Escaleras · silla · caídas o golpes${f.sts30 != null ? ` · prueba 30 s: ${f.sts30}` : ' · prueba de la semana'}`} badge={nF === 3 ? '✓' : `${nF}/3`} ok={nF === 3} />
      <button type="button" className="ej-otra" onClick={() => setView({ v: 'otra' })}>
        {otras.length ? `Otra actividad: ${otras.map((o) => o.label.toLowerCase()).join(', ')}${ex.other_min ? ` · ${ex.other_min} min` : ''}` : '+ Otra actividad (juego, fisio, en cama)'}
      </button>

      {limites && <div className="notice"><strong>Límites de traumatología:</strong> {limites}</div>}
      <p className="muted small">Lo que no se marque cuenta como <strong>no realizado</strong>. Si no se ha podido hacer, mejor decirlo con el motivo.</p>
      <Historico />
    </div>
  )
}

function Tarjeta({ ico, title, sub, badge, ok, onClick }: { ico: string; title: string; sub: string; badge: string; ok: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ej-card" onClick={onClick}>
      <span className={'ej-ico ' + ico} aria-hidden="true">{ICONOS[ico]}</span>
      <span className="ej-txt"><strong>{title}</strong><span>{sub}</span></span>
      <span className={'ej-badge' + (ok ? ' ok' : '')}>{badge}</span>
    </button>
  )
}

const svg = (d: ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const ICONOS: Record<string, ReactNode> = {
  fz: svg(<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />),
  ae: svg(<path d="M3 12h4l2-5 4 10 2-5h6" />),
  pa: svg(<><circle cx="13" cy="4" r="2" /><path d="M10 21l2-7 3 3v4M9 11l3-3 3 3 3 1M12 8l-1 6" /></>),
  cf: svg(<path d="M4 20h4v-4h4v-4h4V8h4" />),
  mn: svg(<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L5 15.5a1.6 1.6 0 0 1 2.4-2L8 14" />),
}

/** Registros antiguos de capacidad funcional semanal (antes de la 0.15). */
function Historico() {
  const weeklyOld = useRows('functional_weekly').sort((a, b) => b.week_start.localeCompare(a.week_start))
  if (!weeklyOld.length) return null
  return (
    <Section title={`Capacidad funcional · registros semanales anteriores (${weeklyOld.length})`}>
      {weeklyOld.map((f) => (
        <div className="item" key={f.id}>
          <div className="main">
            <div className="small">Semana del {fmtDate(f.week_start)}</div>
            <div className="meta">{[f.stairs && 'sube escaleras', f.stands_alone && 'se levanta solo', f.walk_min != null && `paseo ${f.walk_min} min`, f.falls && `caídas: ${f.falls}`].filter(Boolean).join(' · ') || 'sin datos'}</div>
          </div>
          <button className="btn sm ghost" title="Borrar este registro" onClick={async () => { if (await confirmar(`¿Borrar el registro de la semana del ${fmtDate(f.week_start)}?`)) remove('functional_weekly', f.id) }}>✕</button>
        </div>
      ))}
    </Section>
  )
}

// ---------------------------------------------------------------- Fuerza
function Fuerza({ date, setView, limites, all, sesion, view, marcar }: Comun & {
  all: ExerciseSession[]; sesion?: ExerciseSession; view: View; marcar: (k: Kind, on: boolean) => void
}) {
  const [s, setS] = useState<Partial<ExerciseSession>>(() => sesion ?? { date, kind: 'fuerza', exercises: [] })
  useEffect(() => { if (sesion) setS((x) => (x.id ? x : sesion)) }, [sesion?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ex = s.exercises ?? []

  const guardar = async (next: Partial<ExerciseSession>) => {
    const exercises = (next.exercises ?? []).filter((e) => e.name.trim()).map(conResumen)
    if (!next.id && !exercises.length && !next.minutes && !next.intensity) { setS(next); return }
    const saved = await save('exercise_sessions', { ...next, date, kind: 'fuerza', exercises, patient_id: currentPatientId() } as ExerciseSession)
    setS(saved)
    marcar('fuerza', exercises.length > 0)
  }

  const nombres = useMemo(() => {
    const vistos: string[] = []
    for (const x of [...all].filter((x) => x.kind === 'fuerza').sort((a, b) => b.date.localeCompare(a.date))) for (const e of x.exercises) if (e.name && !vistos.some((v) => v.toLowerCase() === e.name.toLowerCase())) vistos.push(e.name)
    return vistos
  }, [all])
  const anterior = useMemo(() => all.filter((x) => x.kind === 'fuerza' && x.date < date && x.exercises.length).sort((a, b) => b.date.localeCompare(a.date))[0], [all, date])

  if (view.v === 'ejercicio') {
    return <EditorEjercicio date={date} inicial={view.i != null ? ex[view.i] : undefined} nombres={nombres}
      onBack={() => setView({ v: 'fuerza' })}
      onSave={async (e) => { const list = view.i != null ? ex.map((x, j) => (j === view.i ? e : x)) : [...ex, e]; await guardar({ ...s, exercises: list }); setView({ v: 'fuerza' }) }}
      onDelete={view.i != null ? async () => { if (await confirmar('¿Borrar este ejercicio?')) { await guardar({ ...s, exercises: ex.filter((_, j) => j !== view.i) }); setView({ v: 'fuerza' }) } } : undefined} />
  }

  return (
    <div>
      <Cabecera title="Fuerza" date={date} onBack={() => setView({ v: 'agenda' })} sub="Apuntad cada ejercicio que haya hecho, con sus series." />
      {limites && <div className="notice"><strong>Límites de traumatología:</strong> {limites}</div>}
      {ex.map((e, i) => (
        <button type="button" key={i} className="ej-card" onClick={() => setView({ v: 'ejercicio', i })}>
          <span className={'ej-num' + ((e.series ?? []).some((x) => x.done) || !e.series ? ' ok' : '')}>{(e.series ?? []).some((x) => x.done) || !e.series ? '✓' : '–'}</span>
          <span className="ej-txt"><strong>{e.name}</strong><span>{resumenEjercicio(e)}</span></span>
          <span className="ej-editar">Editar</span>
        </button>
      ))}
      <button type="button" className="ej-add" onClick={() => setView({ v: 'ejercicio', i: null })}>+ Añadir ejercicio</button>
      {anterior && !ex.length && (
        <button type="button" className="ej-link" onClick={() => guardar({ ...s, exercises: anterior.exercises.map((e) => ({ name: e.name, series: (e.series ?? [{ reps: e.reps ?? null, kg: null }]).map((x) => ({ reps: x.reps ?? null, kg: x.kg ?? null, done: false })) })) })}>
          Copiar los ejercicios del {fmtDate(anterior.date)}
        </button>
      )}
      {anterior && !ex.length && <p className="muted small">Al copiarlos, las series salen sin marcar: tocad ✓ en las que haya hecho hoy.</p>}

      <div className="field"><span>Minutos de la sesión</span>
        <Segmented options={[10, 20, 30, 45, 60].map((m) => ({ value: m, label: m === 60 ? '60+' : String(m) }))} value={s.minutes ?? null} onChange={(v) => guardar({ ...s, minutes: v })} />
      </div>
      <div className="field"><span>¿Cómo le ha ido?</span>
        <Segmented options={[{ value: 'facil' as const, label: 'Fácil' }, { value: 'bien' as const, label: 'Bien' }, { value: 'costo' as const, label: 'Le costó' }]} value={s.intensity ?? null} onChange={(v) => guardar({ ...s, intensity: v ?? undefined })} />
      </div>
      <div className="field"><span>Notas de la sesión</span>
        <textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} onBlur={() => (s.id || ex.length) && guardar(s)} />
      </div>

      <div className="ej-pie">
        <button type="button" className="btn block" onClick={async () => { if (s.id || ex.length) await guardar(s); setView({ v: 'agenda' }) }}>Guardar sesión</button>
        {!ex.length && <button type="button" className="btn block ej-no" onClick={() => setView({ v: 'no', kind: 'fuerza' })}>Hoy no se ha hecho · decir motivo</button>}
        {s.id && ex.length > 0 && <button type="button" className="btn block danger" onClick={async () => { if (await confirmar('¿Borrar toda la sesión de fuerza de este día?')) { await remove('exercise_sessions', s.id!); marcar('fuerza', false); setView({ v: 'agenda' }) } }}>Borrar la sesión</button>}
      </div>
    </div>
  )
}

function EditorEjercicio({ date, inicial, nombres, onBack, onSave, onDelete }: {
  date: string; inicial?: ExerciseItem; nombres: string[]; onBack: () => void; onSave: (e: ExerciseItem) => void; onDelete?: () => void
}) {
  const base: ExerciseSerie[] = inicial?.series ?? (inicial ? [{ reps: inicial.reps ?? null, kg: null, done: true }] : [{ reps: null, kg: null }, { reps: null, kg: null }])
  const [e, setE] = useState<ExerciseItem>({ ...(inicial ?? { name: '' }), series: base })
  const series = e.series ?? []
  const setSerie = (i: number, p: Partial<ExerciseSerie>) => setE({ ...e, series: series.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const [desc, setDesc] = useState(0)
  useEffect(() => { if (desc <= 0) return; const t = setTimeout(() => setDesc(desc - 1), 1000); return () => clearTimeout(t) }, [desc])
  const sugeridos = nombres.filter((n) => n.toLowerCase() !== e.name.trim().toLowerCase() && (!e.name.trim() || n.toLowerCase().includes(e.name.trim().toLowerCase()))).slice(0, 8)

  return (
    <div>
      <Cabecera title={inicial ? 'Editar ejercicio' : 'Añadir ejercicio'} date={date} onBack={onBack} />
      <label className="field"><span>¿Qué ejercicio ha hecho?</span>
        <input type="text" value={e.name} placeholder="Ej.: fondos de tríceps, sentadilla a la silla…" onChange={(ev) => setE({ ...e, name: ev.target.value })} />
      </label>
      {sugeridos.length > 0 && (
        <div className="chips" style={{ marginBottom: '.6rem' }}>
          {sugeridos.map((n) => <button key={n} type="button" className="chip" onClick={() => setE({ ...e, name: n })}>{n}</button>)}
        </div>
      )}

      <div className="card ej-series">
        <div className="ej-serie head"><span>Serie</span><span>Repeticiones</span><span>Peso (kg)</span><span /></div>
        {series.map((x, i) => (
          <div key={i} className="ej-serie">
            <span className="n">{i + 1}</span>
            <input type="number" inputMode="numeric" min={0} aria-label={`Repeticiones de la serie ${i + 1}`} value={x.reps ?? ''} onChange={(ev) => setSerie(i, { reps: num(ev.target.value) })} />
            <input type="number" inputMode="decimal" min={0} step="0.5" aria-label={`Peso de la serie ${i + 1}`} placeholder="sin peso" value={x.kg ?? ''} onChange={(ev) => setSerie(i, { kg: num(ev.target.value) })} />
            <button type="button" className={'ej-tick' + (x.done ? ' on' : '')} aria-label={x.done ? `Serie ${i + 1} hecha` : `Marcar serie ${i + 1} como hecha`} aria-pressed={!!x.done}
              onClick={() => { setSerie(i, { done: !x.done }); if (!x.done && i < series.length - 1) setDesc(90) }}>✓</button>
          </div>
        ))}
        <div className="row between" style={{ marginTop: '.4rem' }}>
          <button type="button" className="btn sm secondary" onClick={() => { const u = series[series.length - 1]; setE({ ...e, series: [...series, { reps: u?.reps ?? null, kg: u?.kg ?? null }] }) }}>+ Añadir serie</button>
          {series.length > 1 && <button type="button" className="btn sm ghost" onClick={() => setE({ ...e, series: series.slice(0, -1) })}>Quitar la última</button>}
        </div>
      </div>
      <div className="row" style={{ marginBottom: '.4rem' }}>
        <button type="button" className="btn sm ghost" onClick={() => setDesc(desc > 0 ? 0 : 90)}>{desc > 0 ? `Descanso: ${desc} s · parar` : 'Contar descanso 90 s'}</button>
      </div>
      <p className="muted small">Tocad ✓ en cada serie que haya terminado. Una serie sin ✓ cuenta como no hecha.</p>
      <label className="field"><span>Nota (dolor, molestias, banda elástica…)</span>
        <input type="text" value={e.note ?? ''} placeholder="Opcional" onChange={(ev) => setE({ ...e, note: ev.target.value })} />
      </label>
      <div className="ej-pie">
        <button type="button" className="btn block" disabled={!e.name.trim()} onClick={() => onSave(e)}>Guardar ejercicio</button>
        {onDelete && <button type="button" className="btn block danger" onClick={onDelete}>Borrar este ejercicio</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Aeróbico
function Aerobico({ date, setView, all, sesiones, edit, marcar }: Comun & {
  all: ExerciseSession[]; sesiones: ExerciseSession[]; edit: string | 'nuevo' | null; marcar: (k: Kind, on: boolean) => void
}) {
  const atras = () => setView({ v: 'agenda' })
  const editando = edit === 'nuevo' ? undefined : sesiones.find((x) => x.id === edit)
  const usados = useMemo(() => {
    const v: string[] = [...AEROBICOS]
    for (const x of [...all].filter((x) => x.kind === 'aerobico').sort((a, b) => b.date.localeCompare(a.date))) for (const e of x.exercises) if (e.name && !v.some((n) => n.toLowerCase() === e.name.toLowerCase())) v.push(e.name)
    return v.slice(0, 10)
  }, [all])

  if (edit !== null) {
    return <EditorAerobico key={edit} date={date} inicial={editando} usados={usados}
      onBack={() => (sesiones.length ? setView({ v: 'aerobico', edit: null }) : atras())}
      onNo={() => setView({ v: 'no', kind: 'aerobico' })}
      onSave={async (row) => { await save('exercise_sessions', { ...row, date, kind: 'aerobico', patient_id: currentPatientId() } as ExerciseSession); marcar('aerobico', true); setView({ v: 'aerobico', edit: null }) }}
      onDelete={editando ? async () => { if (await confirmar('¿Borrar esta actividad?')) { await remove('exercise_sessions', editando.id); if (sesiones.length <= 1) marcar('aerobico', false); setView({ v: sesiones.length > 1 ? 'aerobico' : 'agenda', edit: null } as View) } } : undefined} />
  }

  return (
    <div>
      <Cabecera title="Aeróbico" date={date} onBack={atras} />
      {sesiones.map((x) => (
        <button type="button" key={x.id} className="ej-card" onClick={() => setView({ v: 'aerobico', edit: x.id })}>
          <span className="ej-num ok">✓</span>
          <span className="ej-txt"><strong>{x.exercises.map((e) => e.name).join(', ') || 'Aeróbico'}</strong>
            <span>{[x.minutes ? `${x.minutes} min` : '', x.intensity === 'ligera' ? 'ligero' : x.intensity === 'moderada' ? 'moderado' : x.intensity === 'costo' ? 'le costó' : '', x.exercises[0]?.hr ? `${x.exercises[0].hr} pulsaciones` : ''].filter(Boolean).join(' · ')}</span></span>
          <span className="ej-editar">Editar</span>
        </button>
      ))}
      <button type="button" className="ej-add" onClick={() => setView({ v: 'aerobico', edit: 'nuevo' })}>+ Añadir otra actividad aeróbica</button>
      <div className="ej-pie"><button type="button" className="btn block" onClick={atras}>Listo</button></div>
    </div>
  )
}

function EditorAerobico({ date, inicial, usados, onBack, onSave, onDelete, onNo }: {
  date: string; inicial?: ExerciseSession; usados: string[]; onBack: () => void; onSave: (s: Partial<ExerciseSession>) => void; onDelete?: () => void; onNo: () => void
}) {
  const [s, setS] = useState<Partial<ExerciseSession>>(inicial ?? { exercises: [{ name: '' }] })
  const e0 = s.exercises?.[0] ?? { name: '' }
  const setE0 = (p: Partial<ExerciseItem>) => setS({ ...s, exercises: [{ ...e0, ...p }, ...(s.exercises ?? []).slice(1)] })
  const MIN = [5, 10, 15, 20, 30, 45]
  return (
    <div>
      <Cabecera title="Aeróbico" date={date} onBack={onBack} />
      <label className="field"><span>¿Qué ha hecho?</span>
        <input type="text" value={e0.name} placeholder="Ej.: bicicleta estática" onChange={(ev) => setE0({ name: ev.target.value })} />
      </label>
      <div className="chips" style={{ marginBottom: '.6rem' }}>
        {usados.map((n) => <button key={n} type="button" className={'chip' + (e0.name.trim().toLowerCase() === n.toLowerCase() ? ' on' : '')} onClick={() => setE0({ name: n })}>{n}</button>)}
      </div>
      <div className="field"><span>¿Cuántos minutos?</span>
        <Segmented options={MIN.map((m) => ({ value: m, label: String(m) }))} value={s.minutes ?? null} onChange={(v) => setS({ ...s, minutes: v })} />
        <input type="number" inputMode="numeric" min={0} placeholder="Otro: escribe los minutos" style={{ marginTop: '.4rem' }} value={s.minutes != null && !MIN.includes(s.minutes) ? s.minutes : ''} onChange={(ev) => setS({ ...s, minutes: num(ev.target.value) })} />
      </div>
      <div className="field"><span>¿Cómo le ha resultado?</span>
        <Segmented options={[{ value: 'ligera' as const, label: 'Ligero' }, { value: 'moderada' as const, label: 'Moderado' }, { value: 'costo' as const, label: 'Le costó' }]} value={s.intensity ?? null} onChange={(v) => setS({ ...s, intensity: v ?? undefined })} />
        <div className="muted small">Ligero: podía hablar y cantar · Moderado: hablaba pero no cantaba · Le costó: casi no podía hablar.</div>
      </div>
      <label className="field"><span>Pulsaciones medias (si lleva reloj)</span>
        <input type="number" inputMode="numeric" min={0} placeholder="Opcional" value={e0.hr ?? ''} onChange={(ev) => setE0({ hr: num(ev.target.value) })} />
      </label>
      <label className="field"><span>Notas</span>
        <input type="text" value={s.notes ?? ''} placeholder="Opcional" onChange={(ev) => setS({ ...s, notes: ev.target.value })} />
      </label>
      <div className="ej-pie">
        <button type="button" className="btn block" disabled={!e0.name.trim() || !s.minutes} onClick={() => onSave({ ...s, exercises: [{ ...e0, name: e0.name.trim() }] })}>Guardar</button>
        {(!e0.name.trim() || !s.minutes) && <p className="muted small" style={{ textAlign: 'center' }}>Para guardar hace falta qué ha hecho y los minutos.</p>}
        {onDelete ? <button type="button" className="btn block danger" onClick={onDelete}>Borrar esta actividad</button>
          : <button type="button" className="btn block ej-no" onClick={onNo}>Hoy no se ha hecho · decir motivo</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- No se ha hecho
function NoHecho({ date, draft, setExtra, setView, kind }: Comun & { kind: Kind }) {
  const actual = draft.extra?.ex_no?.[kind]
  const [otro, setOtro] = useState(actual && !MOTIVOS.includes(actual) ? actual : '')
  const elegir = (m: string) => { setExtra({ ex_no: { ...(draft.extra?.ex_no ?? {}), [kind]: m } }); setView({ v: 'agenda' }) }
  return (
    <div>
      <Cabecera title={kind === 'fuerza' ? 'Fuerza: no se ha hecho' : 'Aeróbico: no se ha hecho'} date={date} onBack={() => setView(kind === 'fuerza' ? { v: 'fuerza' } : { v: 'agenda' })} sub="¿Por qué? Ayuda al equipo a entender el día." />
      <div className="ej-motivos">
        {MOTIVOS.map((m) => <button key={m} type="button" className={'ej-motivo' + (actual === m ? ' on' : '')} onClick={() => elegir(m)}>{m}</button>)}
      </div>
      <label className="field"><span>Otro motivo</span>
        <input type="text" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Escríbelo aquí" />
      </label>
      <div className="ej-pie">
        <button type="button" className="btn block" disabled={!otro.trim()} onClick={() => elegir(otro.trim())}>Guardar motivo</button>
        {actual && <button type="button" className="btn block ghost" onClick={() => { const n = { ...(draft.extra?.ex_no ?? {}) }; delete n[kind]; setExtra({ ex_no: n }); setView({ v: 'agenda' }) }}>Quitar «no se ha hecho»</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Paseo y movimiento
/** Minutos de actividad del día fuera de las sesiones: el paseo más largo + otras actividades. */
const minutosDia = (walk: number | null | undefined, otras: number | null | undefined) => ((walk ?? 0) + (otras ?? 0)) || null

function Paseo({ date, draft, set, setExtra, setView }: Comun) {
  const mv = draft.extra?.move_after ?? {}
  const f: FunctionalDaily = draft.extra?.functional ?? {}
  const n = COMIDAS.filter((c) => mv[c.k]).length
  const setWalk = (w: number | null) => {
    setExtra({ functional: { ...f, walk_min: w } })
    set('activity_min', minutosDia(w, draft.extra?.other_min))
    set('activity', { ...(draft.activity ?? {}), paseo: !!w })
  }
  const PASEO = [5, 15, 30, 45, 60]
  return (
    <div>
      <Cabecera title="Paseo y movimiento" date={date} onBack={() => setView({ v: 'agenda' })} />
      <div className="card">
        <strong>Después de comer · {n}/3</strong>
        <p className="muted small">Paseo corto, bailar, jugar de pie… unos minutos después de cada comida.</p>
        <div className="ej-trio">
          {COMIDAS.map((c) => (
            <button key={c.k} type="button" className={'ej-sino' + (mv[c.k] ? ' on' : '')} aria-pressed={!!mv[c.k]} onClick={() => setExtra({ move_after: { ...mv, [c.k]: !mv[c.k] } })}>
              {mv[c.k] ? '✓ ' : ''}{c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <strong>Paseo del día</strong>
        <div className="field"><span>El paseo más largo seguido (minutos)</span>
          <Segmented options={PASEO.map((m) => ({ value: m, label: m === 60 ? '60+' : String(m) }))} value={f.walk_min ?? null} onChange={setWalk} />
          <input type="number" inputMode="numeric" min={0} placeholder="Otro: escribe los minutos" style={{ marginTop: '.4rem' }} value={f.walk_min != null && !PASEO.includes(f.walk_min) ? f.walk_min : ''} onChange={(e) => setWalk(num(e.target.value))} />
        </div>
        {!!f.walk_min && (
          <>
            <div className="field"><span>¿Por qué paró?</span>
              <Segmented options={WALK_STOP.map((o) => ({ value: o.value, label: o.label }))} value={f.walk_stop ?? null} onChange={(v) => setExtra({ functional: { ...f, walk_stop: (v as FunctionalDaily['walk_stop']) ?? null } })} />
            </div>
            <div className="field"><span>¿Con qué ayuda camina?</span>
              <Segmented options={WALK_AID.map((o) => ({ value: o.value, label: o.label }))} value={f.walk_aid ?? null} onChange={(v) => setExtra({ functional: { ...f, walk_aid: (v as FunctionalDaily['walk_aid']) ?? null } })} />
            </div>
          </>
        )}
        <label className="field"><span>Pasos del día (reloj o móvil del cuidador)</span>
          <input type="number" inputMode="numeric" min={0} placeholder="Ej.: 4500" value={draft.steps ?? ''} onChange={(e) => set('steps', num(e.target.value))} />
        </label>
      </div>
      <div className="card">
        <strong>¿Cuánto le ha costado moverse hoy?</strong>
        <p className="muted small">Que lo elija él con las caras, pensando en lo más duro que ha hecho hoy (paseo o ejercicio). De 0 (nada) a 10 (lo máximo).</p>
        <div className="ej-caras">
          {EFFORT_FACES.map((c) => (
            <button key={c.value} type="button" className={'ej-cara' + (draft.extra?.effort === c.value ? ' on' : '')} aria-pressed={draft.extra?.effort === c.value} onClick={() => setExtra({ effort: draft.extra?.effort === c.value ? null : c.value })}>
              <span className="f" aria-hidden="true">{c.face}</span><span className="n">{c.value}</span><span className="l">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ej-pie"><button type="button" className="btn block" onClick={() => setView({ v: 'agenda' })}>Listo</button></div>
      <p className="muted small" style={{ textAlign: 'center' }}>Se guarda solo al tocar.</p>
    </div>
  )
}

// ---------------------------------------------------------------- Ejercicios de la mano
/** 0.38.1 · Una ronda por hora de 9 a 20 h: primero movilizar los dedos y luego la bola. El aviso de cada hora no se
 *  manda si esa ronda ya está marcada. */
function Mano({ date, draft, setExtra, setView }: Comun) {
  const m = draft.extra?.mano ?? {}
  const n = MANO_HORAS.filter((h) => m[h]).length
  return (
    <div>
      <Cabecera title="Ejercicios de la mano" date={date} onBack={() => setView({ v: 'agenda' })} sub="Cada ronda: primero movilizar los dedos y después la bola. Tocad la hora de cada ronda hecha." />
      <div className="card">
        <strong>Rondas de hoy · {n} de {MANO_HORAS.length}</strong>
        <div className="ej-mano">
          {MANO_HORAS.map((h) => (
            <button key={h} type="button" className={'ej-sino' + (m[h] ? ' on' : '')} aria-pressed={!!m[h]} aria-label={m[h] ? `Ronda de las ${Number(h)}:00 hecha` : `Marcar la ronda de las ${Number(h)}:00`}
              onClick={() => setExtra({ mano: { ...m, [h]: !m[h] } })}>
              {m[h] ? '✓ ' : ''}{Number(h)}:00
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">Lo que no se marque cuenta como no realizado. Si hay dolor, hinchazón o cambios en la herida, parad y consultadlo con traumatología.</p>
      <div className="ej-pie"><button type="button" className="btn block" onClick={() => setView({ v: 'agenda' })}>Listo</button></div>
      <p className="muted small" style={{ textAlign: 'center' }}>Se guarda solo al tocar.</p>
    </div>
  )
}

// ---------------------------------------------------------------- Capacidad funcional
function Funcional({ date, draft, setExtra, setView }: Comun) {
  const f: FunctionalDaily = draft.extra?.functional ?? {}
  const setF = (p: Partial<FunctionalDaily>) => setExtra({ functional: { ...f, ...p } })
  const caida = f.falls == null || f.falls === '' ? null : /^(no|ninguna?|nada|-+|0|sin caídas?|no hay)\.?$/i.test(f.falls.trim()) ? false : true
  const SiNo = ({ label, value, onChange }: { label: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void }) => (
    <div className="ej-pregunta">
      <span>{label}</span>
      <button type="button" className={'ej-sino' + (value === true ? ' on' : '')} aria-pressed={value === true} onClick={() => onChange(value === true ? null : true)}>Sí</button>
      <button type="button" className={'ej-sino' + (value === false ? ' on' : '')} aria-pressed={value === false} onClick={() => onChange(value === false ? null : false)}>No</button>
    </div>
  )
  return (
    <div>
      <Cabecera title="Capacidad funcional" date={date} onBack={() => setView({ v: 'agenda' })} sub="Contestad las tres, también cuando sea No." />
      <div className="card">
        <SiNo label="Sube escaleras" value={f.stairs} onChange={(v) => setF({ stairs: v ?? undefined })} />
        <SiNo label="Se levanta solo de la silla" value={f.stands_alone} onChange={(v) => setF({ stands_alone: v ?? undefined })} />
        <SiNo label="Caída o golpe en el miembro afectado" value={caida} onChange={(v) => setF({ falls: v === null ? '' : v ? 'Sí' : 'No' })} />
        {caida && (
          <label className="field"><span>¿Qué pasó? (cómo fue, dónde, si duele)</span>
            <input type="text" value={f.falls === 'Sí' ? '' : f.falls ?? ''} placeholder="Cuéntalo en una frase" onChange={(e) => setF({ falls: e.target.value.trim() ? e.target.value : 'Sí' })} />
          </label>
        )}
      </div>
      <div className="card">
        <strong>Prueba de la semana · una vez por semana</strong>
        <p className="muted small">Sentarse y levantarse de una silla sin brazos durante 30 segundos, con los brazos cruzados. Mismo día de la semana y a la misma hora. Solo si traumatología lo permite.</p>
        <label className="field"><span>Veces en 30 segundos</span>
          <input type="number" inputMode="numeric" min={0} max={40} placeholder="Ej.: 9" value={f.sts30 ?? ''} onChange={(e) => setF({ sts30: num(e.target.value) })} />
        </label>
      </div>
      {caida && <div className="notice">Tras una caída o golpe en el miembro afectado, o un dolor nuevo en el hueso: parad el ejercicio y avisad a oncología como os hayan indicado.</div>}
      <div className="ej-pie"><button type="button" className="btn block" onClick={() => setView({ v: 'agenda' })}>Listo</button></div>
    </div>
  )
}

// ---------------------------------------------------------------- Otra actividad
function Otra({ date, draft, set, setExtra, setView }: Comun) {
  const act = draft.activity ?? {}
  const otherMin = draft.extra?.other_min ?? null
  return (
    <div>
      <Cabecera title="Otra actividad" date={date} onBack={() => setView({ v: 'agenda' })} sub="Juego activo, fisioterapia o movilización en cama." />
      <div className="chips" style={{ marginBottom: '.8rem' }}>
        {OTRAS.map((o) => <button key={o.key} type="button" className={'chip' + (act[o.key] ? ' on' : '')} onClick={() => set('activity', { ...act, [o.key]: !act[o.key] })}>{o.label}</button>)}
      </div>
      <div className="field"><span>Minutos en total</span>
        <Segmented options={[5, 15, 30, 45, 60].map((m) => ({ value: m, label: m === 60 ? '60+' : String(m) }))} value={otherMin} onChange={(v) => { setExtra({ other_min: v }); set('activity_min', minutosDia(draft.extra?.functional?.walk_min, v)) }} />
      </div>
      <div className="ej-pie"><button type="button" className="btn block" onClick={() => setView({ v: 'agenda' })}>Listo</button></div>
    </div>
  )
}
