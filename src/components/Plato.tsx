/** Plato dibujado para valorar una comida (decisión del 28/09/2026, documento «New mock up v2»):
 *  como el plato de Harvard pero para un niño: ½ verdura cocida, ⅓ proteína y el resto hidratos.
 *  Cada parte se toca para ir llenándola: vacía → poca → objetivo (hidratos: nada → poco → ≈ ¼ → más de ¼). */
type Level = number | undefined

const CX = 100
const CY = 100
const R = 88

function pt(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}
/** Sector de corona entre dos ángulos (0° = arriba, sentido horario). */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = pt(r1, a0)
  const [x1, y1] = pt(r1, a1)
  if (r0 <= 0) return `M${CX} ${CY} L${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} Z`
  const [x2, y2] = pt(r0, a1)
  const [x3, y3] = pt(r0, a0)
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

interface Part {
  key: 'veg' | 'prot' | 'starch'
  label: string
  emoji: string
  target: string
  color: string
  a0: number
  a1: number
  levels: string[]
}

const PARTS: Part[] = [
  { key: 'veg', label: 'Verdura', emoji: '🥦', target: '½', color: '#6f8f3a', a0: 0, a1: 180, levels: ['nada', 'poca', '≈ ½ plato'] },
  { key: 'prot', label: 'Proteína', emoji: '🐟', target: '⅓', color: '#b8683f', a0: 180, a1: 300, levels: ['nada', 'poca', '≈ ⅓ plato'] },
  { key: 'starch', label: 'Hidratos', emoji: '🍠', target: 'resto', color: '#c99a2e', a0: 300, a1: 360, levels: ['nada', 'poco', '≈ ¼ plato', 'más de ¼'] },
]

export function Plato({ veg, prot, starch, onChange }: {
  veg: Level
  prot: Level
  starch: Level
  onChange: (patch: { veg?: 0 | 1 | 2; prot?: 0 | 1 | 2; starch?: 0 | 1 | 2 | 3 }) => void
}) {
  const values: Record<Part['key'], Level> = { veg, prot, starch }
  const next = (p: Part) => {
    const v = values[p.key]
    const n = v == null ? 1 : (v + 1) % p.levels.length
    onChange({ [p.key]: n } as never)
  }
  return (
    <div className="plato">
      <svg viewBox="0 0 200 200" role="group" aria-label="Plato: toca cada parte para llenarla">
        <circle cx={CX} cy={CY} r={R + 9} fill="#fff" stroke="#e7e1d6" strokeWidth="2" />
        {PARTS.map((p) => {
          const v = values[p.key]
          const max = p.levels.length - 1
          // Relleno: poca = hasta la mitad del radio; objetivo = entero; «más de ¼» = entero con borde de aviso.
          const fillR = v == null || v === 0 ? 0 : v === 1 ? R * 0.55 : R
          const over = p.key === 'starch' && v === max
          const mid = (p.a0 + p.a1) / 2
          const [lx, ly] = pt(p.key === 'starch' ? R * 0.66 : R * 0.55, mid)
          return (
            <g key={p.key} className="plato-part" role="button" tabIndex={0}
              aria-label={`${p.label}: ${v == null ? 'sin marcar' : p.levels[v]}. Tocar para cambiar`}
              onClick={() => next(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(p) } }}>
              <path d={sector(0, R, p.a0, p.a1)} fill={p.color} fillOpacity={0.07} stroke="#d9d2c4" strokeWidth="1.5" strokeDasharray={v == null ? '4 3' : undefined} />
              {fillR > 0 && <path d={sector(0, fillR, p.a0, p.a1)} fill={p.color} fillOpacity={v === 1 ? 0.55 : 0.85} />}
              {over && <path d={sector(0, R, p.a0, p.a1)} fill="none" stroke="#b23a2f" strokeWidth="3" />}
              <text x={lx} y={ly - (p.key === 'starch' ? 0 : 6)} textAnchor="middle" fontSize={p.key === 'starch' ? 18 : 22}>{p.emoji}</text>
              {p.key !== 'starch' && <text x={lx} y={ly + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#181818">{p.target}</text>}
            </g>
          )
        })}
      </svg>
      <div className="plato-legend">
        {PARTS.map((p) => {
          const v = values[p.key]
          return (
            <button type="button" key={p.key} className={'plato-chip' + (v != null && v > 0 ? ' on' : '')} onClick={() => next(p)}>
              <span className="sw" style={{ background: p.color }} />
              <span><strong>{p.label}</strong> <span className="muted">({p.target})</span><br />{v == null ? 'sin marcar' : p.levels[v]}</span>
            </button>
          )
        })}
        <div className="muted small">Toca cada parte del plato para llenarla.</div>
      </div>
    </div>
  )
}
