import { useEffect, useState } from 'react'
import type { Challenge } from '../store/types'
import { addDays, fmtDate, todayStr, weekStart } from '../domain/dates'
import { GOAL_DEFAULT, SHIELD_DEFAULT, weekPoints } from '../domain/reto'
import { guardarReto, ICONOS_PREMIO, useReto } from '../pages/Reto'
import { Forma } from './Huma'
import { Field } from './ui'

/** Ajustes del reto de la semana (solo la familia): premio, meta, nombre de la criatura e historial. */
export function RetoAjustes() {
  const { week, ch, challenges, name, inp } = useReto()
  const start = weekStart(todayStr())
  const [f, setF] = useState<Partial<Challenge>>({})
  useEffect(() => { setF({ prize: ch.prize ?? '', prize_icon: ch.prize_icon ?? '🎁', goal: ch.goal, shield_min: ch.shield_min, creature_name: ch.creature_name ?? name }) }, [ch.id, ch.prize, ch.prize_icon, ch.goal, ch.shield_min, ch.creature_name, name])
  const set = <K extends keyof Challenge>(k: K, v: Challenge[K]) => setF((x) => ({ ...x, [k]: v }))
  const guardar = () => guardarReto(ch, start, {
    prize: f.prize?.trim() || null,
    prize_icon: f.prize_icon || null,
    goal: Number(f.goal) || GOAL_DEFAULT,
    shield_min: Number(f.shield_min) || SHIELD_DEFAULT,
    creature_name: f.creature_name?.trim() || null,
  })
  // Semanas anteriores con reto guardado (o con puntos), de la más reciente a la más antigua.
  const previas = Array.from(new Set([...challenges.map((c) => c.week_start), ...[1, 2, 3, 4].map((i) => addDays(start, -7 * i))]))
    .filter((s) => s < start).sort((a, b) => b.localeCompare(a)).slice(0, 6)

  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}><Forma k="fenix" size={20} width={2} /> Reto de la semana</h3>
      <p className="muted small">Lo que ve el niño en la pestaña Reto. Aquí se pone el premio y la meta de cada semana; el reto nuevo empieza solo cada lunes.</p>
      <div className="reto-eyebrow" style={{ marginBottom: '.4rem' }}>Semana del {fmtDate(start)} al {fmtDate(addDays(start, 6))}</div>
      <Field label="Nombre de la criatura (lo elige él)"><input type="text" value={f.creature_name ?? ''} onChange={(e) => set('creature_name', e.target.value)} placeholder="Huma" /></Field>
      <Field label="Premio de esta semana"><input type="text" value={f.prize ?? ''} onChange={(e) => set('prize', e.target.value)} placeholder="p. ej. Juego nuevo de Nintendo" /></Field>
      <Field label="Icono del premio">
        <div className="chips">
          {ICONOS_PREMIO.map((i) => <button key={i} type="button" className={'chip ' + (f.prize_icon === i ? 'on' : '')} style={{ fontSize: '1.2rem', padding: '.25rem .55rem' }} onClick={() => set('prize_icon', i)}>{i}</button>)}
        </div>
      </Field>
      <div className="grid2">
        <Field label="Meta de puntos" hint="Máximo 700 (100 al día). Con 500 se pide un 70 %"><input type="number" min={100} max={700} step={50} value={f.goal ?? ''} onChange={(e) => set('goal', Number(e.target.value))} /></Field>
        <Field label="Mínimo en día de hospital" hint="Puntos asegurados en quimio, ingreso o urgencias"><input type="number" min={0} max={100} step={10} value={f.shield_min ?? ''} onChange={(e) => set('shield_min', Number(e.target.value))} /></Field>
      </div>
      <div className="row">
        <button className="btn" onClick={guardar}>Guardar</button>
        {ch.delivered_at && <span className="tag verde">premio entregado</span>}
      </div>

      <h3>Semana en curso</h3>
      <div className="row between small">
        <span><strong>{week.total}</strong> de {week.goal} · nivel {week.level + 1} de 6</span>
        <span className={'tag ' + (week.won ? 'verde' : 'gray')}>{week.won ? 'meta conseguida' : 'en marcha'}</span>
      </div>
      <div className="reto-semana">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => {
          const dp = week.days.find((x) => x.date === addDays(week.start, i))
          return <div key={d} className="reto-dia"><span className="small muted">{d}</span><span className="reto-dia-pts">{dp ? dp.total : '·'}{dp?.shield ? ' 🛡️' : ''}</span></div>
        })}
      </div>

      {previas.length > 0 && (
        <>
          <h3>Semanas anteriores</h3>
          {previas.map((s) => {
            const c = challenges.find((x) => x.week_start === s)
            const w = weekPoints(s, inp, c?.goal ?? GOAL_DEFAULT, c?.shield_min ?? SHIELD_DEFAULT)
            if (!c && w.total === 0) return null
            return (
              <div key={s} className="item">
                <div className="main">
                  <div>{fmtDate(s)} – {fmtDate(w.end)}{c?.prize ? ` · ${c.prize_icon ?? ''} ${c.prize}` : ''}</div>
                  <div className="meta">{w.total} de {w.goal} puntos</div>
                </div>
                <span className={'tag ' + (c?.delivered_at ? 'verde' : w.won ? 'amarillo' : 'gray')}>{c?.delivered_at ? 'entregado' : w.won ? 'conseguido, sin entregar' : 'no alcanzado'}</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
