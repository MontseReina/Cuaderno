import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { currentPatientId, save, useRows } from '../store'
import type { Challenge } from '../store/types'
import { addDays, todayStr } from '../domain/dates'
import { CATS, challengeFor, creatureName, FORMS, formAt, trainerName, weekPoints, type CatKey, type RetoInputs, type WeekPoints } from '../domain/reto'
import { evaluar, PODERES, relatoDelDia } from '../domain/relato'
import { SAGA_INICIO } from '../domain/saga'
import { EscenaFinal, HumaArt } from '../components/Huma'
import { RelatoPlayer } from '../components/RelatoPlayer'
import { Field } from '../components/ui'
import { confirmar } from '../components/Confirmar'

export const ICONOS_PREMIO = ['🎮', '🏛️', '🍦', '🎬', '🧩', '⚽', '🎁', '🍕', '🎢', '📚']

/** Guarda (o crea) el reto de la semana con los cambios indicados. */
export async function guardarReto(ch: ReturnType<typeof challengeFor>, start: string, patch: Partial<Challenge>) {
  // trainer_name solo se envía si tiene valor (así guardar el premio nunca depende de esa columna).
  const trainer = patch.trainer_name !== undefined ? patch.trainer_name : ch.trainer_name
  const row = {
    ...(ch.id ? { id: ch.id } : {}),
    patient_id: currentPatientId(),
    week_start: start,
    prize: ch.prize ?? null,
    prize_icon: ch.prize_icon ?? null,
    goal: ch.goal,
    shield_min: ch.shield_min,
    creature_name: ch.creature_name ?? null,
    delivered_at: ch.delivered_at ?? null,
    ...patch,
  } as Challenge
  delete (row as Partial<Challenge>).trainer_name
  if (trainer) row.trainer_name = trainer
  await save('challenges', row)
}

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const corto = (d: string) => { const x = new Date(d + 'T12:00'); return `${x.getDate()} ${MESES[x.getMonth()]}` }
/** Primer lunes del reto (semanas anteriores no cuentan para las semanas conseguidas). */
const RETO_INICIO = '2026-09-21'

/** Último nivel que ha visto el niño en este dispositivo (para saber si hay que enseñar la evolución). */
const seenKey = (start: string) => `huma_reto_nivel_${start}`
const getSeen = (start: string) => { try { const v = localStorage.getItem(seenKey(start)); return v == null ? null : Number(v) } catch { return null } }
const setSeen = (start: string, lvl: number) => { try { localStorage.setItem(seenKey(start), String(lvl)) } catch { /* sin almacenamiento */ } }

export function useReto(anchor = todayStr()) {
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const products = useRows('products')
  const intakes = useRows('intakes')
  const sessions = useRows('exercise_sessions')
  const challenges = useRows('challenges')
  const inp: RetoInputs = { logs, cycles, products, intakes, sessions }
  const start = weekPoints(anchor, inp).start
  const ch = challengeFor(challenges, start)
  const week = weekPoints(anchor, inp, ch.goal, ch.shield_min)
  return { week, ch, challenges, name: creatureName(challenges), trainer: trainerName(challenges), inp }
}

export default function Reto() {
  const { section } = useParams()
  const { week, ch, name, trainer, inp, challenges } = useReto()
  const [evo, setEvo] = useState<number | null>(null)
  const [editando, setEditando] = useState(false)
  const hoyStr = todayStr()
  /** Semana de prueba (antes del estreno del lunes 28/09/2026): sin relato y con Huma en silueta,
   *  para que el niño no descubra todavía las fases. */
  const prueba = hoyStr < SAGA_INICIO

  // ¿Ha subido de nivel desde la última vez que se abrió esta pantalla? → pantalla de evolución.
  useEffect(() => {
    const seen = getSeen(week.start)
    if (seen == null || prueba) { setSeen(week.start, week.level); return }
    if (week.level > seen) setEvo(week.level)
  }, [week.start, week.level, prueba])

  const hoy = week.days[week.days.length - 1]
  const relato = useMemo(() => relatoDelDia({
    date: hoyStr, inp, entrenador: trainer, criatura: name, goal: week.goal, shieldMin: ch.shield_min,
    semana: week.total, nivel: week.level, hoyEscudo: !!hoy?.shield,
  }), [hoyStr, inp, trainer, name, week.goal, ch.shield_min, week.total, week.level, hoy?.shield])

  // Semanas anteriores conseguidas (desde que empezó el reto).
  const conseguidas = useMemo(() => {
    let n = 0
    for (let s = RETO_INICIO; s < week.start; s = addDays(s, 7)) {
      const c = challengeFor(challenges, s)
      if (weekPoints(addDays(s, 6), inp, c.goal, c.shield_min).won) n++
    }
    return n
  }, [challenges, inp, week.start])

  if (section === 'puntos') return <ComoGano goal={week.goal} shieldMin={ch.shield_min} name={name} nivel={prueba ? -1 : week.level} />
  if (evo != null) return <Evolucion nivel={evo} name={name} goal={week.goal} onOk={() => { setSeen(week.start, evo); setEvo(null) }} />
  if (!prueba && week.won && !ch.delivered_at) return <Premio week={week} ch={ch} name={name} />

  const forma = FORMS[week.level]
  const nextLvl = Math.min(FORMS.length - 1, week.level + 1)
  const nextAt = formAt(nextLvl, week.goal)
  const pct = Math.min(100, Math.round((week.total / week.goal) * 100))
  const perDay = week.daysLeft > 0 ? Math.ceil(week.remaining / week.daysLeft) : week.remaining

  return (
    <div className="reto2">
      <div className="r2-marca" aria-hidden="true"><HumaArt k={forma.key} silueta={prueba} /></div>

      <ComoGanoArriba name={name} goal={week.goal} shieldMin={ch.shield_min} />

      {/* Ficha del fénix */}
      <section className={'card r2-hero nivel-' + week.level}>
        <div className="r2-eyebrow">{trainer ? `Entrenador ${trainer}` : 'Tu fénix'}</div>
        <div className="r2-hero-art"><HumaArt k={forma.key} silueta={prueba} /></div>
        <div className="r2-hero-nombre">{name} <span className="r2-nv">Nv. {week.level + 1}</span></div>
        <div className="r2-hero-forma">{prueba ? 'Fase ??? · se descubre el lunes' : `Fase ${forma.name} · tipo Fuego y Valentía`}</div>
        <div className="r2-xp" role="img" aria-label={`${week.total} de ${week.goal} puntos`}>
          <div className="r2-xp-fill" style={{ width: `${pct}%` }} />
          {[1, 2, 3, 4].map((i) => <i key={i} style={{ left: `${i * 20}%` }} />)}
        </div>
        <div className="r2-xp-txt"><strong>{week.total}</strong> de {week.goal} puntos {ch.delivered_at && <span className="tag verde">premio conseguido ✓</span>}</div>
        {week.won
          ? <p className="r2-bocadillo">{name} ha llegado a su forma final. ¡Eres un gran entrenador!</p>
          : <p className="r2-bocadillo">
            {name} evoluciona a los <strong>{nextAt}</strong> puntos: faltan <strong>{Math.max(0, nextAt - week.total)}</strong>.
            {week.daysLeft > 0 && perDay <= 100 && <> Con {perDay} al día, el premio es tuyo.</>}
            {week.daysLeft > 0 && perDay > 100 && <> Esta semana el premio queda lejos, pero cada punto hace crecer a {name}.</>}
          </p>}
        {conseguidas > 0 && <div className="r2-chispas">{'✨'.repeat(Math.min(conseguidas, 10))} {conseguidas === 1 ? '1 semana conseguida' : `${conseguidas} semanas conseguidas`}</div>}
      </section>

      {!prueba && <RelatoPlayer relato={relato} date={hoyStr} />}

      <Mision date={hoyStr} name={name} inp={inp} shieldMin={ch.shield_min} />

      {hoy && <PoderesHoy hoy={hoy} shieldMin={ch.shield_min} name={name} />}

      <section className="card">
        <div className="r2-titulo">Evoluciones de {name}</div>
        <LineaEvolucion nivel={prueba ? -1 : week.level} goal={week.goal} />
      </section>

      <section className="card">
        <div className="row between"><div className="r2-titulo">Esta semana</div><span className="muted small">{corto(week.start)} → {corto(week.end)}</span></div>
        <div className="r2-semana">
          {DIAS.map((d, i) => {
            const date = addDays(week.start, i)
            const dp = week.days.find((x) => x.date === date)
            const esHoy = date === hoyStr
            const llamas = dp ? (dp.total >= 80 ? 3 : dp.total >= 50 ? 2 : dp.total > 0 ? 1 : 0) : 0
            return (
              <Link key={d} to={dp ? `/diario/${date}` : '#'} className={'r2-dia ' + (esHoy ? 'hoy ' : '') + (dp ? '' : 'futuro')} onClick={(e) => { if (!dp) e.preventDefault() }}>
                <span className="r2-dia-l">{d}</span>
                <span className="r2-dia-ico">{dp?.shield ? '🛡️' : llamas ? '🔥' : '·'}</span>
                <span className="r2-dia-pts">{dp ? dp.total : ''}</span>
                {llamas > 1 && <span className="r2-dia-extra">{'★'.repeat(llamas - 1)}</span>}
              </Link>
            )
          })}
        </div>
      </section>

      {editando
        ? <PremioEditor ch={ch} start={week.start} onClose={() => setEditando(false)} />
        : (
          <section className="card r2-premio" onClick={() => setEditando(true)} style={{ cursor: 'pointer' }}>
            <div className="r2-premio-ico">{ch.prize_icon || '🎁'}</div>
            <div style={{ flex: 1 }}>
              <div className="r2-eyebrow">Premio de la semana · con {week.goal} puntos</div>
              <div className="r2-premio-nombre">{ch.prize || 'Todavía sin premio: toca aquí para ponerlo'}</div>
              <div className="muted small">{DIA_LARGO[1]} {corto(week.start)} → domingo {corto(week.end)}</div>
            </div>
            <span className="muted" aria-label="Cambiar el premio">✎</span>
          </section>
        )}
    </div>
  )
}

/** «¿Cómo gano poderes?» arriba del todo: abierto al empezar cada día, se puede plegar. */
function ComoGanoArriba({ name, goal, shieldMin }: { name: string; goal: number; shieldMin: number }) {
  const key = 'huma_como_plegado'
  const hoy = todayStr()
  const [abierto, setAbierto] = useState(() => { try { return localStorage.getItem(key) !== hoy } catch { return true } })
  const toggle = () => { const v = !abierto; setAbierto(v); try { if (v) localStorage.removeItem(key); else localStorage.setItem(key, hoy) } catch { /* nada */ } }
  return (
    <section className="card r2-como">
      <button type="button" className="r2-como-head" onClick={toggle} aria-expanded={abierto}>
        <span>📖 ¿Cómo gano poderes?</span><span className="r2-como-flecha">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <>
        <p className="r2-como-intro">Eres el <strong>entrenador</strong> de {name}. Cada cosa que se apunta en la app le da un <strong>poder</strong>. Con los poderes ganas puntos y, cada {formAt(1, goal)} puntos, <strong>{name} evoluciona</strong>.</p>
        <div className="r2-poderes-grid">
          {CATS.map((c) => {
            const p = PODERES[c.key]
            return (
              <div key={c.key} className="r2-poder-tile" style={{ ['--c' as string]: p.color }}>
                <div className="r2-poder-ico">{p.emoji}</div>
                <div className="r2-poder-nom">{p.poder}</div>
                <div className="r2-poder-acc">{c.emoji} {c.label}</div>
                <div className="r2-poder-max">hasta {c.max}</div>
              </div>
            )
          })}
        </div>
        <ul className="r2-como-lista">
          <li>🏆 Con <strong>{goal} puntos</strong> en la semana, ¡premio!</li>
          <li>🛡️ Días de Torre (hospital): <strong>{shieldMin} puntos</strong> seguros por ser valiente.</li>
          <li>⬆️ Los puntos solo suben, nunca bajan. Cada lunes {name} renace del huevo, más fuerte.</li>
          <li>📻 Cada día hay un capítulo nuevo de la aventura.</li>
        </ul>
        <Link to="/reto/puntos" className="r2-link">Ver todas las reglas ›</Link>
      </>}
    </section>
  )
}

const FRASE_MISION: Record<CatKey, string> = {
  comer: 'Su llama está pequeñita. Cada bocado es una chispa: medio plato también cuenta.',
  beber: 'Anda un poco seco. Muchos sorbitos a lo largo del día, como las tortugas del río.',
  moverse: 'Su rayo está dormido. Muévete como puedas: un paseo, estirar los brazos, jugar.',
  medicinas: 'Su escudo tiene algún agujerito. Cada poción tomada es una pieza nueva.',
  dormir: 'Necesita energía de luna: dormir bien y un ratito de sol por la mañana.',
  estoy: 'Quiere saber cómo estás. Contarlo también es de valientes.',
}

/** La misión: el poder más flojo de los tres días anteriores. */
function Mision({ date, name, inp, shieldMin }: { date: string; name: string; inp: RetoInputs; shieldMin: number }) {
  const ev = useMemo(() => evaluar(date, inp, shieldMin), [date, inp, shieldMin])
  const p = ev.necesita ? PODERES[ev.necesita] : null
  return (
    <section className="card r2-mision" style={{ ['--c' as string]: p?.color ?? '#E8B400' }}>
      <div className="r2-mision-ico">{p ? p.emoji : '🌟'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="r2-eyebrow">🎯 Misión de hoy</div>
        {p
          ? <><div className="r2-mision-tit">{name} necesita {p.largo}</div><p className="r2-mision-txt">{FRASE_MISION[ev.necesita!]}</p>
            <Link to={p.ruta} className="r2-mision-link">¿Está apuntado? Pide a mamá o a la tía que lo miren ›</Link></>
          : <><div className="r2-mision-tit">{ev.dias ? '¡Todos los poderes van fenomenal!' : 'Primera misión: ganar poderes'}</div>
            <p className="r2-mision-txt">{ev.dias ? 'La misión de hoy es mantener el fuego encendido, igual que hasta ahora.' : `Apunta todo lo que puedas hoy y ${name} empezará a brillar.`}</p></>}
        {ev.dias > 0 && (
          <div className="r2-medias" title="Cómo han ido los poderes los días anteriores">
            {CATS.map((c) => <span key={c.key} className={'r2-media ' + (c.key === ev.necesita ? 'flojo' : '')}>{PODERES[c.key].emoji} {ev.medias[c.key]}%</span>)}
          </div>
        )}
      </div>
    </section>
  )
}

/** Los poderes de hoy, como las estadísticas de una criatura. */
function PoderesHoy({ hoy, shieldMin, name }: { hoy: WeekPoints['days'][number]; shieldMin: number; name: string }) {
  return (
    <section className="card">
      <div className="row between"><div className="r2-titulo">Poderes de hoy</div><div className="r2-hoy-total">{hoy.total}<span>/100</span></div></div>
      {hoy.shield && <p className="r2-escudo">🛡️ Día de Torre: {shieldMin} puntos asegurados por ser valiente.</p>}
      {hoy.cats.map((c) => {
        const p = PODERES[c.key]
        const lleno = c.pts >= c.max
        return (
          <Link key={c.key} to={p.ruta} className="r2-stat" style={{ ['--c' as string]: p.color }}>
            <div className="r2-stat-ico">{p.emoji}</div>
            <div className="r2-stat-body">
              <div className="r2-stat-top"><strong>{p.poder}</strong><span className="muted small">{c.label} · {c.detail}</span></div>
              <div className="r2-stat-bar"><div style={{ width: `${(c.pts / c.max) * 100}%` }} /></div>
              {c.pts === 0 && <div className="r2-stat-pide">¡Pide que lo apunten para que {name} gane este poder!</div>}
            </div>
            <div className="r2-stat-pts">{lleno ? '✓' : c.pts}<span>/{c.max}</span></div>
          </Link>
        )
      })}
    </section>
  )
}

/** Línea de evolución: las conseguidas en color, la actual resaltada, las que faltan en silueta. */
function LineaEvolucion({ nivel, goal }: { nivel: number; goal: number }) {
  return (
    <div className="r2-linea">
      {FORMS.map((f, i) => (
        <div key={f.key} className="r2-linea-paso">
          <div className={'r2-evo ' + (i < nivel ? 'hecha' : i === nivel ? 'actual' : 'falta')}>
            <div className="r2-evo-art"><HumaArt k={f.key} silueta={i > nivel} /></div>
            <div className="r2-evo-nom">{i <= nivel ? f.name : '???'}</div>
            <div className="r2-evo-pts">{formAt(i, goal)} pts</div>
          </div>
          {i < FORMS.length - 1 && <span className="r2-linea-flecha">›</span>}
        </div>
      ))}
    </div>
  )
}

/** Poner o cambiar el premio desde la propia pantalla del reto (lo hace la familia). */
function PremioEditor({ ch, start, onClose }: { ch: ReturnType<typeof challengeFor>; start: string; onClose: () => void }) {
  const [prize, setPrize] = useState(ch.prize ?? '')
  const [icon, setIcon] = useState(ch.prize_icon ?? '🎁')
  const guardar = async () => { await guardarReto(ch, start, { prize: prize.trim() || null, prize_icon: icon }); onClose() }
  return (
    <div className="card">
      <div className="r2-eyebrow">Premio de la semana</div>
      <Field label="¿Qué premio se gana esta semana?"><input type="text" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="p. ej. Juego nuevo de Nintendo" autoFocus /></Field>
      <Field label="Icono">
        <div className="chips">
          {ICONOS_PREMIO.map((i) => <button key={i} type="button" className={'chip ' + (icon === i ? 'on' : '')} style={{ fontSize: '1.2rem', padding: '.25rem .55rem' }} onClick={() => setIcon(i)}>{i}</button>)}
        </div>
      </Field>
      <div className="row">
        <button className="btn" onClick={guardar}>Guardar</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
      <p className="muted small">La meta ({ch.goal} puntos), el nombre de la criatura y el del entrenador se cambian en Pilares → Ajustes.</p>
    </div>
  )
}

/** Pantalla de evolución, como en los juegos: destellos, silueta que parpadea y la forma nueva. */
function Evolucion({ nivel, name, goal, onOk }: { nivel: number; name: string; goal: number; onOk: () => void }) {
  const f = FORMS[nivel]
  const prev = FORMS[nivel - 1] ?? FORMS[0]
  const next = FORMS[nivel + 1]
  const [fase, setFase] = useState<'cambio' | 'listo'>('cambio')
  useEffect(() => { const t = setTimeout(() => setFase('listo'), 2600); return () => clearTimeout(t) }, [])
  return (
    <div className="r2-evo-pantalla" onClick={() => fase === 'listo' && onOk()}>
      <svg className="r2-evo-rayos" viewBox="-100 -100 200 200" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => <path key={i} d="M0 0 L-9 -140 L9 -140 Z" transform={`rotate(${i * 20})`} />)}
      </svg>
      <div className="r2-eyebrow" style={{ color: '#FFD23F' }}>{fase === 'cambio' ? '¿Qué está pasando?' : nivel === FORMS.length - 1 ? '¡Forma final!' : '¡Nueva forma!'}</div>
      <div className={'r2-evo-escena ' + fase}>
        <div className="r2-evo-vieja"><HumaArt k={prev.key} /></div>
        <div className="r2-evo-nueva"><HumaArt k={f.key} /></div>
      </div>
      {fase === 'cambio'
        ? <h1 className="r2-evo-titulo">¡{name} está evolucionando!</h1>
        : <>
          <h1 className="r2-evo-titulo">¡{name} ha evolucionado a {f.name}!</h1>
          <div className="r2-evo-nivel">Nivel {nivel + 1} · {prev.name} → {f.name}</div>
          {next
            ? <p className="r2-evo-sig">La siguiente forma se desbloquea a los {formAt(nivel + 1, goal)} puntos.</p>
            : <p className="r2-evo-sig">¡Ya no hay más formas! Has llegado al final de la semana como un campeón.</p>}
          <button className="r2-evo-btn" onClick={onOk}>¡Genial!</button>
        </>}
    </div>
  )
}

function Premio({ week, ch, name }: { week: WeekPoints; ch: ReturnType<typeof challengeFor>; name: string }) {
  const entregar = async () => {
    if (!await confirmar('¿Marcar el premio como entregado?')) return
    await save('challenges', { ...(ch as Partial<Challenge>), id: ch.id, patient_id: currentPatientId(), week_start: week.start, goal: ch.goal, shield_min: ch.shield_min, delivered_at: new Date().toISOString() } as Challenge)
  }
  return (
    <div className="reto2 r2-ganado">
      <div className="r2-ganado-escena"><EscenaFinal /></div>
      <h1 className="r2-ganado-titulo">¡Lo has conseguido!</h1>
      <p className="muted"><strong>{name}</strong> ha llegado a su forma final: Fénix Supremo · <strong style={{ color: 'var(--green)' }}>{week.total} de {week.goal} puntos</strong></p>
      <div className="card r2-premio ganado">
        <div className="r2-premio-ico">{ch.prize_icon || '🎁'}</div>
        <div>
          <div className="r2-eyebrow">Tu premio</div>
          <div className="r2-premio-nombre">{ch.prize || 'El premio que hayáis acordado'}</div>
          <div className="muted small">semana del {corto(week.start)} al {corto(week.end)}</div>
        </div>
      </div>
      <div className="r2-semana card">
        {week.days.map((d, i) => <div key={d.date} className="r2-dia"><span className="r2-dia-l">{DIAS[i]}</span><span className="r2-dia-ico">🔥</span><span className="r2-dia-pts">{d.total}</span></div>)}
      </div>
      <p className="r2-bocadillo" style={{ textAlign: 'center' }}>Enséñale esta pantalla a mamá o a la tía para recoger tu premio.</p>
      <button className="btn secondary" onClick={entregar}>Premio entregado ✓</button>
      <p className="muted small" style={{ textAlign: 'center' }}>Solo lo pulsa la familia. El lunes {name} renace y empieza un reto nuevo.</p>
    </div>
  )
}

function ComoGano({ goal, shieldMin, name, nivel }: { goal: number; shieldMin: number; name: string; nivel: number }) {
  return (
    <div className="reto2">
      <div className="row" style={{ gap: '.6rem' }}><Link to="/reto" className="btn sm ghost" aria-label="Volver al reto">‹</Link><h1 className="r2-h1" style={{ margin: 0 }}>¿Cómo gano poderes?</h1></div>
      <p className="r2-bocadillo"><strong>Cada día puedes ganar hasta 100 puntos.</strong> Los puntos solo suben, nunca bajan. Se cuentan solos con lo que se apunta en la app.</p>
      <div className="card">
        {CATS.map((c) => {
          const p = PODERES[c.key]
          return (
            <div key={c.key} className="r2-regla" style={{ ['--c' as string]: p.color }}>
              <div className="r2-stat-ico">{p.emoji}</div>
              <div><strong>{p.tipo}</strong> <span className="muted small">· {c.emoji} {c.label}</span><div className="muted small">{c.rule}</div></div>
              <div className="r2-stat-pts">{c.max}</div>
            </div>
          )
        })}
      </div>
      <div className="card r2-regla">
        <div className="r2-stat-ico">🛡️</div>
        <div><strong>Días de Torre (hospital)</strong><div className="muted small">Los días de quimio, de ingreso o de urgencias ya tienes <strong>{shieldMin} puntos asegurados</strong> por ser valiente. Y puedes seguir sumando hasta 100.</div></div>
      </div>
      <div className="card">
        <strong>La semana y el premio</strong>
        <p className="muted small">De lunes a domingo puedes juntar hasta 700 puntos. <strong>Con {goal} ganas el premio.</strong> Cada {formAt(1, goal)} puntos {name} evoluciona y cambia de forma. Cada lunes vuelve a su huevo para renacer más fuerte, como hacen los fénix.</p>
        <LineaEvolucion nivel={nivel} goal={goal} />
      </div>
      <div className="card">
        <strong>📻 El relato de cada día</strong>
        <p className="muted small">Cada día hay un capítulo nuevo de la aventura de {name}. El relato mira cómo han ido los poderes los tres días anteriores y te da una misión: el poder que más necesita {name}.</p>
      </div>
    </div>
  )
}

