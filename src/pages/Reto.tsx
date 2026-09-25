import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { currentPatientId, save, useRows } from '../store'
import type { Challenge } from '../store/types'
import { addDays, todayStr } from '../domain/dates'
import { CATS, challengeFor, creatureName, FORMS, formAt, weekPoints, type RetoInputs, type WeekPoints } from '../domain/reto'
import { Forma } from '../components/Huma'
import { Field } from '../components/ui'

export const ICONOS_PREMIO = ['🎮', '🏛️', '🍦', '🎬', '🧩', '⚽', '🎁', '🍕', '🎢', '📚']

/** Guarda (o crea) el reto de la semana con los cambios indicados. */
export async function guardarReto(ch: ReturnType<typeof challengeFor>, start: string, patch: Partial<Challenge>) {
  await save('challenges', {
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
  } as Challenge)
}

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const corto = (d: string) => { const x = new Date(d + 'T12:00'); return `${x.getDate()} ${MESES[x.getMonth()]}` }

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
  return { week, ch, challenges, name: creatureName(challenges), inp }
}

export default function Reto() {
  const { section } = useParams()
  const { week, ch, name } = useReto()
  const [evo, setEvo] = useState<number | null>(null)
  const [editando, setEditando] = useState(false)

  // ¿Ha subido de nivel desde la última vez que se abrió esta pantalla? → pantalla de evolución.
  useEffect(() => {
    const seen = getSeen(week.start)
    if (seen == null) { setSeen(week.start, week.level); return }
    if (week.level > seen) setEvo(week.level)
  }, [week.start, week.level])

  if (section === 'puntos') return <ComoGano goal={week.goal} shieldMin={ch.shield_min} name={name} />
  if (evo != null) return <Evolucion nivel={evo} name={name} goal={week.goal} onOk={() => { setSeen(week.start, evo); setEvo(null) }} />
  if (week.won && !ch.delivered_at) return <Premio week={week} ch={ch} name={name} />

  const hoy = week.days[week.days.length - 1]
  const nextLvl = Math.min(FORMS.length - 1, week.level + 1)
  const nextAt = formAt(nextLvl, week.goal)
  const perDay = week.daysLeft > 0 ? Math.ceil(week.remaining / week.daysLeft) : week.remaining
  const pct = Math.min(100, Math.round((week.total / week.goal) * 100))

  return (
    <div className="reto">
      {editando
        ? <PremioEditor ch={ch} start={week.start} onClose={() => setEditando(false)} />
        : (
          <div className="card reto-premio" onClick={() => setEditando(true)} style={{ cursor: 'pointer' }}>
            <div className="reto-premio-ico">{ch.prize_icon || '🎁'}</div>
            <div style={{ flex: 1 }}>
              <div className="reto-eyebrow">Premio de la semana</div>
              <div className="reto-premio-nombre">{ch.prize || 'Todavía sin premio: toca aquí para ponerlo'}</div>
              <div className="muted small">{DIA_LARGO[1]} {corto(week.start)} → domingo {corto(week.end)}</div>
            </div>
            <span className="muted" aria-label="Cambiar el premio">✎</span>
          </div>
        )}

      <div className="card">
        <div className="reto-total"><span className="reto-num">{week.total}</span><span className="muted">de {week.goal} puntos</span>{ch.delivered_at && <span className="tag verde">premio conseguido ✓</span>}</div>
        <div className="reto-bar"><div className="reto-fill" style={{ width: `${pct}%` }} />{[1, 2, 3, 4].map((i) => <i key={i} style={{ left: `${i * 20}%` }} />)}</div>
        <Ficha nivel={week.level} goal={week.goal} />
        {week.won
          ? <p className="reto-msg">{name} ha llegado a su forma final. ¡Premio conseguido!</p>
          : <>
            <p><strong>Nivel {week.level + 1} · {FORMS[week.level].name}.</strong> {name} vuelve a evolucionar a los {nextAt} puntos: te faltan <strong>{Math.max(0, nextAt - week.total)}</strong>.</p>
            {week.daysLeft > 0 && perDay > 100
              ? <p className="reto-msg">Esta semana la meta queda lejos, pero cada punto hace crecer a {name}. ¡A por la siguiente forma!</p>
              : week.daysLeft > 0
              ? <p className="reto-msg">Te quedan {week.daysLeft === 1 ? 'hoy' : `${week.daysLeft} días`} y {week.remaining} puntos: con {perDay} al día, el premio es tuyo.</p>
              : <p className="reto-msg">La semana ha terminado con {week.total} puntos. El lunes empieza un reto nuevo.</p>}
          </>}
      </div>

      {hoy && (
        <div className="card">
          <div className="row between"><h2 style={{ margin: 0 }}>Hoy, {DIA_LARGO[new Date(hoy.date + 'T12:00').getDay()]}</h2><strong className="reto-hoy">{hoy.total} puntos</strong></div>
          {hoy.shield && <p className="muted small">🛡️ Día de hospital: {ch.shield_min} puntos asegurados por ser valiente.</p>}
          {hoy.cats.map((c) => (
            <div key={c.key} className="reto-cat">
              <div className="reto-cat-ico">{c.emoji}</div>
              <div>
                <div className="row between small"><strong>{c.label}</strong><span className="muted">{c.detail}</span></div>
                <div className="reto-mini"><div style={{ width: `${(c.pts / c.max) * 100}%` }} /></div>
              </div>
              <div className="reto-cat-pts">{c.pts}<span className="muted">/{c.max}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="card tight">
        <div className="reto-eyebrow">Esta semana</div>
        <div className="reto-semana">
          {DIAS.map((d, i) => {
            const date = addDays(week.start, i)
            const dp = week.days.find((x) => x.date === date)
            const esHoy = date === todayStr()
            return (
              <Link key={d} to={dp ? `/diario/${date}` : '#'} className={'reto-dia ' + (esHoy ? 'hoy' : '')} onClick={(e) => { if (!dp) e.preventDefault() }}>
                <span className="small muted">{d}</span>
                <span className="reto-dia-pts">{dp ? dp.total : '·'}</span>
                {dp?.shield ? <span className="reto-escudo">🛡️</span> : <span className={'dot ' + (dp ? 'verde' : 'gris')} />}
              </Link>
            )
          })}
        </div>
        <p className="muted small">🛡️ Día de hospital: {ch.shield_min} puntos asegurados por ser valiente.</p>
      </div>

      <p style={{ textAlign: 'center' }}><Link to="/reto/puntos"><strong>¿Cómo gano puntos?</strong></Link></p>
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
      <div className="reto-eyebrow">Premio de la semana</div>
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
      <p className="muted small">La meta ({ch.goal} puntos) y el nombre de la criatura se cambian en Pilares → Ajustes.</p>
    </div>
  )
}

/** Ficha de evoluciones: las desbloqueadas en color, la actual resaltada, las que faltan con «?». */
function Ficha({ nivel, goal }: { nivel: number; goal: number }) {
  return (
    <div className="reto-ficha">
      {FORMS.map((f, i) => (
        <div key={f.key} className={'reto-forma ' + (i < nivel ? 'hecha' : i === nivel ? 'actual' : 'falta')}>
          <div className="reto-forma-ico">{i <= nivel ? <Forma k={f.key} size={30} color={i === nivel ? '#fff' : 'var(--green)'} width={i === nivel ? 2 : 1.8} /> : '?'}</div>
          <div className="reto-forma-nombre">{i <= nivel ? f.name : `${formAt(i, goal)} pts`}</div>
        </div>
      ))}
    </div>
  )
}

function Evolucion({ nivel, name, goal, onOk }: { nivel: number; name: string; goal: number; onOk: () => void }) {
  const f = FORMS[nivel]
  const prev = FORMS[nivel - 1]
  const next = FORMS[nivel + 1]
  return (
    <div className="reto-evo" onClick={onOk}>
      <div className="reto-evo-rayos" />
      <div className="reto-eyebrow" style={{ color: 'var(--primary-soft)' }}>{nivel === FORMS.length - 1 ? 'Forma final' : 'Nuevo nivel'}</div>
      <div className="reto-evo-forma"><Forma k={f.key} size={120} color="var(--ink-deep)" width={1.6} /></div>
      <h1 className="reto-evo-titulo">¡{name} ha evolucionado!</h1>
      <div className="reto-evo-nivel">Nivel {nivel + 1} · {f.name}</div>
      {prev && (
        <div className="reto-evo-cambio">
          <div><Forma k={prev.key} size={40} color="var(--primary-soft)" /><div>{prev.name}</div></div>
          <span>→</span>
          <div><Forma k={f.key} size={40} color="#fff" width={2} /><div><strong>{f.name}</strong></div></div>
        </div>
      )}
      {next
        ? <p style={{ color: 'var(--primary-soft)' }}>La siguiente forma, <strong style={{ color: '#fff' }}>{next.name}</strong>, se desbloquea a los {formAt(nivel + 1, goal)} puntos.</p>
        : <p style={{ color: 'var(--primary-soft)' }}>Ya no hay más formas: ¡has llegado al final!</p>}
      <button className="btn reto-evo-btn" onClick={onOk}>¡Genial!</button>
    </div>
  )
}

function Premio({ week, ch, name }: { week: WeekPoints; ch: ReturnType<typeof challengeFor>; name: string }) {
  const entregar = async () => {
    if (!confirm('¿Marcar el premio como entregado?')) return
    await save('challenges', { ...(ch as Partial<Challenge>), id: ch.id, patient_id: currentPatientId(), week_start: week.start, goal: ch.goal, shield_min: ch.shield_min, delivered_at: new Date().toISOString() } as Challenge)
  }
  return (
    <div className="reto reto-ganado">
      <div className="reto-evo-forma final"><Forma k="fenix" size={64} color="var(--primary-soft)" width={1.6} /></div>
      <h1 className="reto-ganado-titulo">¡Lo has conseguido!</h1>
      <p className="muted"><strong>{name}</strong> ha llegado a su forma final: Fénix · <strong style={{ color: 'var(--green)' }}>{week.total} de {week.goal} puntos</strong></p>
      <div className="card reto-premio ganado">
        <div className="reto-premio-ico">{ch.prize_icon || '🎁'}</div>
        <div>
          <div className="reto-eyebrow">Tu premio</div>
          <div className="reto-premio-nombre">{ch.prize || 'El premio que hayáis acordado'}</div>
          <div className="muted small">semana del {corto(week.start)} al {corto(week.end)}</div>
        </div>
      </div>
      <div className="reto-semana card tight">
        {week.days.map((d, i) => <div key={d.date} className="reto-dia"><span className="small muted">{DIAS[i]}</span><span className="reto-dia-pts">{d.total}</span></div>)}
      </div>
      <p className="reto-msg" style={{ textAlign: 'center' }}>Enséñale esta pantalla a mamá o a la tía para recoger tu premio.</p>
      <button className="btn secondary" onClick={entregar}>Premio entregado ✓</button>
      <p className="muted small" style={{ textAlign: 'center' }}>Solo lo pulsa la familia. El lunes empieza un reto nuevo con otro premio.</p>
    </div>
  )
}

function ComoGano({ goal, shieldMin, name }: { goal: number; shieldMin: number; name: string }) {
  return (
    <div className="reto">
      <div className="row" style={{ gap: '.6rem' }}><Link to="/reto" className="btn sm ghost" aria-label="Volver al reto">‹</Link><h1 style={{ margin: 0 }}>¿Cómo gano puntos?</h1></div>
      <p className="reto-msg"><strong>Cada día puedes ganar hasta 100 puntos.</strong> Los puntos solo suben, nunca bajan. Se cuentan solos con lo que se apunta en la app.</p>
      <div className="card tight">
        {CATS.map((c) => (
          <div key={c.key} className="reto-regla">
            <div className="reto-cat-ico">{c.emoji}</div>
            <div><strong>{c.label}</strong><div className="muted small">{c.rule}</div></div>
            <div className="reto-cat-pts" style={{ color: 'var(--green)' }}>{c.max}</div>
          </div>
        ))}
      </div>
      <div className="card tight reto-regla">
        <div className="reto-cat-ico">🛡️</div>
        <div><strong>Días de hospital</strong><div className="muted small">Los días de quimio, de ingreso o de urgencias ya tienes <strong>{shieldMin} puntos asegurados</strong> por ser valiente. Y puedes seguir sumando hasta 100.</div></div>
      </div>
      <div className="card tight">
        <strong>La semana y el premio</strong>
        <p className="muted small">De lunes a domingo puedes juntar hasta 700 puntos. <strong>Con {goal} ganas el premio.</strong> Cada {formAt(1, goal)} puntos {name} evoluciona y cambia de forma. Las que faltan van saliendo con «?» hasta que las desbloqueas:</p>
        <div className="reto-ficha">
          {FORMS.map((f, i) => (
            <div key={f.key} className={'reto-forma ' + (i === FORMS.length - 1 ? 'actual' : 'hecha')}>
              <div className="reto-forma-ico"><Forma k={f.key} size={26} color={i === FORMS.length - 1 ? '#fff' : 'var(--green)'} /></div>
              <div className="reto-forma-nombre">{f.name}</div>
              <div className="muted" style={{ fontSize: '.7rem' }}>{formAt(i, goal)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
