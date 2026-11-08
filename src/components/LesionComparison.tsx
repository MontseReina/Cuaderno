import type { Finding, FindingVerdict } from '../store/types'

/** 0.43.0 · Tabla comparativa de lesiones entre informes.
 *  Filas = lesión (hallazgo + localización), columnas = fecha de cada informe,
 *  última columna = evolución. Las lesiones que aparecen por primera vez en un
 *  informe posterior se colocan al final. Solo ordena lo escrito: la
 *  interpretación la hace el equipo. */

export const VERDICTS: { value: FindingVerdict; label: string }[] = [
  { value: 'disminuye', label: 'Disminuye' },
  { value: 'igual', label: 'Sin cambios' },
  { value: 'aumenta', label: 'Aumenta' },
  { value: 'nueva', label: 'Nueva' },
  { value: 'no_visto', label: 'No se ve' },
]
const VERDICT_TAG: Record<FindingVerdict, string> = { disminuye: 'verde', igual: 'gray', aumenta: 'rojo', nueva: 'rojo', no_visto: 'gray' }

const mm = (n: number) => n.toString().replace('.', ',')
const fecha = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}` }
const keyOf = (f: Finding) => `${(f.name ?? '').trim().toLowerCase()}|${(f.location ?? '').trim().toLowerCase()}`

interface Grupo { key: string; name: string; location?: string; byDate: Map<string, Finding>; first: string; idx: number }

export function agruparLesiones(rows: Finding[]) {
  const validas = rows.filter((r) => r.name?.trim() && r.date)
  const fechas = Array.from(new Set(validas.map((r) => r.date))).sort()
  const grupos = new Map<string, Grupo>()
  validas.forEach((r, i) => {
    const k = keyOf(r)
    const g = grupos.get(k) ?? { key: k, name: r.name.trim(), location: r.location?.trim(), byDate: new Map(), first: r.date, idx: i }
    g.byDate.set(r.date, r)
    if (r.date < g.first) g.first = r.date
    grupos.set(k, g)
  })
  const lista = Array.from(grupos.values()).sort((a, b) => a.first.localeCompare(b.first) || a.idx - b.idx)
  return { fechas, lista }
}

/** Evolución de una lesión: manda lo que dice el último informe; si no lo dice, se calcula con los mm. */
export function evolucion(g: Grupo, fechas: string[]): { label: string; tag: string; porInforme: boolean } {
  const ultimaFecha = fechas[fechas.length - 1]
  const ultima = g.byDate.get(ultimaFecha)
  if (ultima?.verdict) return { label: VERDICTS.find((v) => v.value === ultima.verdict)!.label, tag: VERDICT_TAG[ultima.verdict], porInforme: true }
  if (!ultima) return { label: 'No descrita en el último informe', tag: 'gray', porInforme: false }
  if (g.first !== fechas[0]) return { label: 'Nueva', tag: 'rojo', porInforme: false }
  const medidas = fechas.map((d) => g.byDate.get(d)?.size_mm).filter((x): x is number => x != null)
  if (medidas.length < 2) return { label: '—', tag: 'gray', porInforme: false }
  const delta = Math.round((medidas[medidas.length - 1] - medidas[0]) * 10) / 10
  if (delta === 0) return { label: 'Sin cambios', tag: 'gray', porInforme: false }
  return { label: `${delta > 0 ? 'Aumenta' : 'Disminuye'} (${delta > 0 ? '+' : ''}${mm(delta)} mm)`, tag: delta > 0 ? 'rojo' : 'verde', porInforme: false }
}

export default function LesionComparison({ rows, compact }: { rows: Finding[]; compact?: boolean }) {
  const { fechas, lista } = agruparLesiones(rows)
  if (!lista.length) return null
  const notas: string[] = []
  const nota = (texto?: string) => {
    if (!texto?.trim()) return null
    let n = notas.indexOf(texto.trim())
    if (n < 0) { notas.push(texto.trim()); n = notas.length - 1 }
    return <sup>{n + 1}</sup>
  }
  const fuentes = fechas.map((d) => rows.find((r) => r.date === d && r.source)?.source)
  return (
    <div className="lesiones" onClick={(e) => e.stopPropagation()}>
      <div className="table-wrap">
        <table className="table lesiontable">
          <thead>
            <tr>
              <th>Lesión</th>
              {fechas.map((d) => <th key={d} className="num">{fecha(d)}</th>)}
              <th>Evolución</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((g) => {
              const ev = evolucion(g, fechas)
              const esNueva = g.first !== fechas[0]
              return (
                <tr key={g.key} className={esNueva ? 'nueva' : ''}>
                  <td>
                    <strong>{g.name}</strong>
                    {g.location && <div className="muted small">{g.location}</div>}
                  </td>
                  {fechas.map((d) => {
                    const f = g.byDate.get(d)
                    if (!f) return <td key={d} className="num muted small">{d < g.first ? 'no descrita' : '—'}</td>
                    const valor = f.verdict === 'no_visto' && f.size_mm == null ? 'No se ve' : f.size_mm != null ? `${mm(f.size_mm)} mm` : 'sin medida'
                    return <td key={d} className="num">{valor}{f.count != null && f.count > 1 ? <span className="muted small"> ×{f.count}</span> : null}{nota(f.notes)}</td>
                  })}
                  <td><span className={'tag ' + ev.tag}>{ev.label}</span>{!compact && !ev.porInforme && ev.label !== '—' && <div className="muted small">por medida</div>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {notas.length > 0 && (
        <ol className="muted small lesionnotas">{notas.map((n, i) => <li key={i}>{n}</li>)}</ol>
      )}
      {!compact && (
        <p className="muted small">
          {fuentes.some(Boolean) && <>Informes: {fechas.map((d, i) => `${fecha(d)} ${fuentes[i] ?? ''}`.trim()).join(' · ')}. </>}
          «Evolución» es lo que dice el último informe; si no lo dice, la resta de milímetros («por medida»). «No se ve» no significa que haya desaparecido. Las lesiones nuevas van al final. La interpretación la hace el equipo.
        </p>
      )}
    </div>
  )
}
