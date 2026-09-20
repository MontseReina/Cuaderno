import { useNavigate } from 'react-router-dom'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import type { ReactNode } from 'react'

/** Barra ‹ fecha › compartida por Diario, Nutrición, Hidratación y Biohacking. */
export function DateNav({ date, base, sub }: { date: string; base: string; sub?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="row between" style={{ marginBottom: '.6rem' }}>
      <button className="btn sm ghost" onClick={() => nav(`${base}/${addDays(date, -1)}`)}>‹</button>
      <div style={{ textAlign: 'center' }}>
        <strong>{date === todayStr() ? 'Hoy' : fmtDate(date)}</strong>
        {sub && <div className="muted small">{sub}</div>}
      </div>
      <button className="btn sm ghost" disabled={date >= todayStr()} onClick={() => nav(`${base}/${addDays(date, 1)}`)}>›</button>
    </div>
  )
}
