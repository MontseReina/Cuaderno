import { Link } from 'react-router-dom'
import { useRows } from '../store'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { dayCompleteness } from '../domain/completeness'
import { medicationProgress } from '../domain/medication'

/** «Cómo se está rellenando el registro»: tira de los últimos 21 días (hoy a la izquierda) y racha.
 *  Estaba en Inicio; desde la 0.18.0 va en Evaluaciones, entre el título y el informe semanal. */
export function RegistroCard() {
  const today = todayStr()
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const products = useRows('products')
  const intakes = useRows('intakes')
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const regOf = (d: string) => dayCompleteness(byDate.get(d), d, medicationProgress(products, intakes, cycles, d))
  const strip = Array.from({ length: 21 }, (_, i) => {
    const d = addDays(today, -i)
    const l = byDate.get(d)
    const r = regOf(d)
    return { d, reg: l ? r.level : '', pct: Math.round((r.done / r.total) * 100) }
  })
  let streak = 0
  for (let i = byDate.has(today) ? 0 : 1; byDate.has(addDays(today, -i)); i++) streak++
  // Media de lo rellenado en los días de la racha (para saber si se registra bien, no solo si se abre la app).
  const streakDays = Array.from({ length: streak }, (_, i) => addDays(today, -(byDate.has(today) ? i : i + 1)))
  const streakPct = streakDays.length
    ? Math.round(streakDays.reduce((acc, d) => { const r = regOf(d); return acc + r.done / r.total }, 0) / streakDays.length * 100)
    : 0
  return (
    <div className="card tight">
      <h3 style={{ margin: '0 0 .3rem' }}>Cómo se está rellenando el registro</h3>
      <div className="strip">
        {strip.map((s) => (
          <Link key={'r' + s.d} to={`/diario/${s.d}`} style={{ flex: 1, display: 'contents' }}>
            <span className={s.reg} title={`${fmtDate(s.d)}: ${s.pct} % del registro`} />
          </Link>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: '.4rem' }}>
        <span className="dot verde" />100 % <span className="dot amarillo" />50 % <span className="dot rojo" />0 % · gris: sin registro
      </div>
      {streak > 0 && (
        <div className="muted small" style={{ marginTop: '.2rem' }}>
          Racha: {streak} día{streak > 1 ? 's' : ''} seguido{streak > 1 ? 's' : ''} registrando, al {streakPct} % de media
        </div>
      )}
    </div>
  )
}
