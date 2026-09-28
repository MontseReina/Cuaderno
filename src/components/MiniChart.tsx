import { useState } from 'react'

/** Gráfico pequeño de una sola serie (peso, altura, grasa, músculo, agua).
 *  Barras: una columna por día de medición. Línea: evolución. Un solo eje por gráfico;
 *  al tocar una marca se ve su valor y su fecha arriba. */
export interface ChartPoint { x: string; y: number }

const W = 320
const H = 120
const PAD = { l: 8, r: 8, t: 10, b: 22 }

export function MiniChart({ title, unit, points, kind, decimals = 1, color = 'var(--primary)' }: {
  title: string
  unit: string
  points: ChartPoint[]
  kind: 'bar' | 'line'
  decimals?: number
  color?: string
}) {
  const [sel, setSel] = useState<number | null>(null)
  if (!points.length) return null
  const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const ys = points.map((p) => p.y)
  let lo = Math.min(...ys)
  let hi = Math.max(...ys)
  if (hi - lo < 1e-9) { lo -= 1; hi += 1 }
  // Barras desde una base un poco por debajo del mínimo (si no, todas miden casi igual).
  const span = hi - lo
  const base = kind === 'bar' ? lo - span * 0.6 - 0.5 : lo - span * 0.15
  const top = hi + span * 0.15
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const n = points.length
  const slot = iw / n
  const X = (i: number) => PAD.l + slot * i + slot / 2
  const Y = (v: number) => PAD.t + ih - ((v - base) / (top - base)) * ih
  const shown = sel ?? n - 1
  const every = Math.ceil(n / 6) // como mucho 6 fechas bajo el eje
  const bw = Math.min(28, slot * 0.6)

  return (
    <div className="minichart">
      <div className="row between">
        <span className="small"><strong>{title}</strong></span>
        <span className="small"><strong>{fmt(points[shown].y)} {unit}</strong> <span className="muted">· {points[shown].x}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.x} ${fmt(p.y)} ${unit}`).join(', ')}`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="var(--line)" />
        {kind === 'line' && n > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points.map((p, i) => `${X(i)},${Y(p.y)}`).join(' ')} />
        )}
        {points.map((p, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <title>{`${p.x}: ${fmt(p.y)} ${unit}`}</title>
            {/* Zona de toque más grande que la marca */}
            <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih} fill="transparent" />
            {kind === 'bar'
              ? <path d={`M${X(i) - bw / 2} ${PAD.t + ih} V${Y(p.y) + 4} q0 -4 4 -4 H${X(i) + bw / 2 - 4} q4 0 4 4 V${PAD.t + ih} Z`} fill={color} fillOpacity={i === shown ? 1 : 0.55} />
              : <circle cx={X(i)} cy={Y(p.y)} r={i === shown ? 5 : 3.5} fill={color} stroke="var(--card)" strokeWidth="2" />}
            {(i % every === 0 || i === n - 1) && <text x={X(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{p.x}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}
