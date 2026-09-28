import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { DailyLog } from '../store/types'
import { addDays } from '../domain/dates'
import { cycleContext, vomitSeverity } from '../domain/cycle'
import { dayNutrition, totalFluids, weekMode } from '../domain/nutrition'
import { FLUID_TARGET, SYMPTOMS, URINE_COLORS } from '../domain/catalogs'
import type { Cycle } from '../store/types'
import { controlDelDia, nauseaMax } from '../domain/nausea'

/** Cuadro de mandos de la semana (Evaluaciones, pedido en «New mock up v2»): días en columnas (L-D) y
 *  los datos en filas. Los síntomas que aparecen como leves o más se quedan hasta el domingo; el lunes
 *  el cuadro empieza de cero. Sin infusiones (la manzanilla ya suma en el total de líquidos). */
type Nivel = '' | 'ok' | 'ambar' | 'rojo'
interface Celda { txt: string; nivel?: Nivel; titulo?: string; color?: string }

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const SEV = ['No', 'L', 'M', 'I']
const SEV_LARGO = ['No', 'Leve', 'Moderado', 'Intenso']

function constantes(l?: DailyLog): Celda {
  const vs = Object.values(l?.extra?.vitals ?? {}).filter(Boolean)
  if (!vs.length) return { txt: '' }
  const fuera: string[] = []
  for (const v of vs) {
    if (v!.sys != null && (v!.sys < 86 || v!.sys > 110)) fuera.push(`sistólica ${v!.sys}`)
    if (v!.dia != null && v!.dia > 73) fuera.push(`diastólica ${v!.dia}`)
    if (v!.pulse != null && (v!.pulse < 75 || v!.pulse > 118)) fuera.push(`pulso ${v!.pulse}`)
    if (v!.spo2 != null && v!.spo2 < 94) fuera.push(`saturación ${v!.spo2} %`)
  }
  const vals = vs.map((v) => [v!.sys != null && v!.dia != null ? `${v!.sys}/${v!.dia}` : null, v!.pulse != null ? `${v!.pulse} lpm` : null, v!.spo2 != null ? `${v!.spo2} %` : null].filter(Boolean).join(' · ')).filter(Boolean).join(' | ')
  if (!vals) return { txt: '' }
  return fuera.length ? { txt: '!', nivel: 'ambar', titulo: `Fuera de rango: ${fuera.join(', ')} (${vals})` } : { txt: '✓', nivel: 'ok', titulo: vals }
}

export function CuadroMandos({ lunes, logs, cycles }: { lunes: string; logs: DailyLog[]; cycles: Cycle[] }) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const logOf = (d: string) => byDate.get(d)

  const filas: { key: string; label: string; sub?: boolean; celdas: Celda[] }[] = []
  filas.push({
    key: 'fiebre', label: '🌡️ Fiebre (Tª máx.)',
    celdas: dias.map((d) => {
      const t = logOf(d)?.temp_max
      if (t == null) return { txt: '' }
      return { txt: String(t).replace('.', ','), nivel: t >= 38 ? 'rojo' : t >= 37.5 ? 'ambar' : 'ok', titulo: `${t} °C` }
    }),
  })
  filas.push({ key: 'constantes', label: '❤️ Constantes', celdas: dias.map((d) => constantes(logOf(d))) })
  filas.push({
    key: 'comidas', label: '🥣 Comidas',
    celdas: dias.map((d) => {
      const l = logOf(d)
      if (!l) return { txt: '' }
      const n = dayNutrition(l, weekMode(l, cycleContext(cycles, d)))
      return { txt: `${n.meals}/${n.target}`, nivel: n.meals >= n.target ? 'ok' : n.meals >= Math.ceil(n.target / 2) ? 'ambar' : 'rojo', titulo: `${n.meals} de ${n.target} comidas` }
    }),
  })
  filas.push({
    key: 'vomitos', label: '🤢 Vómitos',
    celdas: dias.map((d) => {
      const l = logOf(d)
      if (!l) return { txt: '' }
      const n = l.extra?.vomits?.length ?? 0
      const sev = vomitSeverity(l.extra)
      return { txt: String(n), nivel: sev >= 3 ? 'rojo' : n > 0 ? 'ambar' : 'ok' }
    }),
  })
  // Náuseas (0.25.0): máximo del día en la escala 0-10 y color del control de náuseas y vómitos.
  filas.push({
    key: 'nauseas', label: '😣 Náuseas (0-10)',
    celdas: dias.map((d) => {
      const l = logOf(d)
      const c = controlDelDia(l)
      if (!l || !c) return { txt: '' }
      const max = nauseaMax(l.extra?.nausea)
      const legacy = l.symptoms?.nauseas ?? 0
      const txt = max != null ? String(max) : legacy ? SEV[legacy] : '0'
      return { txt, nivel: c.nivel === 'verde' ? 'ok' : c.nivel, titulo: c.motivos.length ? c.motivos.join(', ') : 'Control completo' }
    }),
  })
  filas.push({
    key: 'rescates', label: 'Rescates', sub: true,
    celdas: dias.map((d) => {
      const r = logOf(d)?.extra?.nausea?.rescates ?? []
      if (!r.length) return { txt: '' }
      const ok = r.filter((x) => x.efecto === 'si').length
      return { txt: String(r.length), nivel: r.some((x) => x.efecto === 'no') || r.length >= 2 ? 'rojo' : 'ambar', titulo: `${r.length} rescate${r.length > 1 ? 's' : ''}, ${ok} ${ok === 1 ? 'eficaz' : 'eficaces'}` }
    }),
  })
  filas.push({
    key: 'liquidos', label: '💧 Líquidos (ml)',
    celdas: dias.map((d) => {
      const l = logOf(d)
      const t = totalFluids(l)
      if (t == null) return { txt: '' }
      const obj = FLUID_TARGET[weekMode(l, cycleContext(cycles, d))]
      return { txt: String(t), nivel: t >= obj ? 'ok' : t >= obj * 0.7 ? 'ambar' : 'rojo', titulo: `${t} ml de ${obj}` }
    }),
  })
  filas.push({ key: 'agua', label: 'Agua', sub: true, celdas: dias.map((d) => ({ txt: logOf(d)?.water_ml != null ? String(logOf(d)!.water_ml) : '' })) })
  filas.push({ key: 'mar', label: 'Agua de mar', sub: true, celdas: dias.map((d) => ({ txt: logOf(d)?.seawater_ml != null ? String(logOf(d)!.seawater_ml) : '' })) })
  filas.push({ key: 'caldo', label: 'Caldo (½ tazas)', sub: true, celdas: dias.map((d) => ({ txt: logOf(d)?.broth_cups != null ? String(logOf(d)!.broth_cups) : '' })) })
  filas.push({
    key: 'orina', label: '🟡 Orina (color)',
    celdas: dias.map((d) => {
      const c = logOf(d)?.urine_color
      return c ? { txt: '', color: URINE_COLORS[c - 1], nivel: c >= 4 ? 'ambar' : '', titulo: `Color ${c} de 6` } : { txt: '' }
    }),
  })
  filas.push({
    key: 'deposiciones', label: '💩 Deposiciones',
    celdas: dias.map((d) => {
      const l = logOf(d)
      if (!l || l.stools_n == null) return { txt: '' }
      const b = l.bristol
      const nivel: Nivel = l.stools_n === 0 ? 'ambar' : b != null && (b <= 2 || b >= 6) ? 'ambar' : 'ok'
      const bb = l.stools_n > 0 && b ? b : null
      return { txt: `${l.stools_n}${bb ? `·B${bb}` : ''}`, nivel, titulo: `${l.stools_n} deposiciones${bb ? `, Bristol tipo ${bb}` : ''}` }
    }),
  })

  // Síntomas marcados como leves o más en algún día de la semana: se quedan hasta el domingo.
  const hasta = dias.filter((d) => byDate.has(d))
  const claves: string[] = []
  for (const d of hasta) for (const [k, v] of Object.entries(logOf(d)!.symptoms ?? {})) if (v > 0 && k !== 'vomitos' && k !== 'nauseas' && !claves.includes(k)) claves.push(k)
  const nombre = (k: string) => SYMPTOMS.find((s) => s.key === k)?.label ?? k.replace(/^dx_/, '').replace(/_/g, ' ')
  for (const k of claves) {
    filas.push({
      key: 's_' + k, label: nombre(k),
      celdas: dias.map((d) => {
        const l = logOf(d)
        if (!l) return { txt: '' }
        const v = l.symptoms?.[k] ?? 0
        return { txt: SEV[v], nivel: v >= 3 ? 'rojo' : v === 2 ? 'ambar' : v === 1 ? 'ambar' : 'ok', titulo: SEV_LARGO[v] }
      }),
    })
  }

  return (
    <div className="cuadro-wrap">
      <table className="cuadro">
        <colgroup><col className="c-lbl" />{Array.from({ length: 7 }, (_, i) => <col key={i} />)}</colgroup>
        <thead>
          <tr>
            <th />
            {dias.map((d, i) => <th key={d}><Link to={`/diario/${d}`}>{DIAS[i]}<span>{Number(d.slice(8))}</span></Link></th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <Fragment key={f.key}>
              {i === filas.length - claves.length && claves.length > 0 && (
                <tr key="sep" className="cuadro-sep"><td colSpan={8}>Síntomas de la semana</td></tr>
              )}
              <tr className={f.sub ? 'sub' : ''}>
                <td className="cuadro-lbl">{f.label}</td>
                {f.celdas.map((c, j) => (
                  <td key={j} className={'cuadro-c ' + (c.nivel ?? '')} title={c.titulo}>
                    {c.color ? <span className="cuadro-orina" style={{ background: c.color }} /> : c.txt}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      {claves.length === 0 && <div className="muted small" style={{ marginTop: '.3rem' }}>Esta semana no se ha marcado ningún síntoma.</div>}
      <div className="muted small" style={{ marginTop: '.4rem' }}>
        Verde: bien · ámbar: vigilar · rojo: avisar. L/M/I = leve, moderado, intenso. B = tipo de Bristol. Toca un día para abrir su registro.
      </div>
    </div>
  )
}
