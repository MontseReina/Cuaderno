/** Vaso que se llena hacia el objetivo de líquidos del día (Hidratación, 0.27.0). */
export function Vaso({ total, objetivo, nivel }: { total: number; objetivo: number; nivel: 'verde' | 'amarillo' | 'rojo' }) {
  const pct = objetivo > 0 ? Math.min(1, total / objetivo) : 0
  const y0 = 12, y1 = 142, alto = y1 - y0
  const nivelY = y1 - alto * pct
  const color = nivel === 'verde' ? '#7fb0bb' : nivel === 'amarillo' ? '#e6be62' : '#e0897f'
  const vaso = 'M14 12 L96 12 L84 142 L26 142 Z'
  return (
    <svg className="vaso" viewBox="0 0 110 154" role="img" aria-label={`${total} de ${objetivo} ml (${Math.round(pct * 100)} %)`}>
      <defs><clipPath id="vaso-clip"><path d={vaso} /></clipPath></defs>
      <rect x="0" y={nivelY} width="110" height={y1 - nivelY} fill={color} clipPath="url(#vaso-clip)" />
      {pct > 0 && pct < 1 && <path d={`M10 ${nivelY} q 12 -4 24 0 t 24 0 t 24 0 t 24 0`} fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" clipPath="url(#vaso-clip)" />}
      <line x1="20" x2="90" y1={y0 + alto / 2} y2={y0 + alto / 2} stroke="#b9b2a4" strokeDasharray="3 3" strokeWidth="1" />
      <path d={vaso} fill="none" stroke="#3D4126" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="55" y={y0 + alto / 2 - 4} textAnchor="middle" fontSize="10" fill="#6d7266">50 %</text>
      <text x="55" y="92" textAnchor="middle" fontSize="20" fontWeight="800" fill="#181818">{Math.round(pct * 100)} %</text>
    </svg>
  )
}
