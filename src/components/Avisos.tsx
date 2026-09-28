import type { ReactNode } from 'react'

/** Franja de avisos de una pantalla (documento «New mock up v2»: «panel de estos avisos, buscar otro diseño»).
 *  Una sola tarjeta con una línea por aviso; el color dice la gravedad y el detalle se abre al tocar.
 *  rojo = llamar hoy · ambar = revisar con el equipo · info = para saber. */
export type AvisoNivel = 'rojo' | 'ambar' | 'info'
export interface Aviso {
  key: string
  nivel: AvisoNivel
  icono: string
  titulo: ReactNode
  detalle?: ReactNode
}

const NIVEL_LABEL: Record<AvisoNivel, string> = { rojo: 'Llamar', ambar: 'Revisar', info: 'Para saber' }
const ORDEN: AvisoNivel[] = ['rojo', 'ambar', 'info']

export function Avisos({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) return null
  const lista = [...avisos].sort((a, b) => ORDEN.indexOf(a.nivel) - ORDEN.indexOf(b.nivel))
  const cuenta = ORDEN.map((n) => ({ n, c: avisos.filter((a) => a.nivel === n).length })).filter((x) => x.c)
  return (
    <details className="avisos" open>
      <summary>
        <span>⚠️ {avisos.length === 1 ? '1 aviso' : `${avisos.length} avisos`}</span>
        <span className="avisos-cuenta">
          {cuenta.map(({ n, c }) => <span key={n} className={'aviso-chip ' + n}>{c} {NIVEL_LABEL[n].toLowerCase()}</span>)}
        </span>
      </summary>
      <div className="avisos-lista">
        {lista.map((a) => (
          a.detalle
            ? (
              <details key={a.key} className={'aviso ' + a.nivel}>
                <summary><span className="aviso-ico" aria-hidden>{a.icono}</span><span className="aviso-tit">{a.titulo}</span><span className="aviso-mas" aria-hidden>›</span></summary>
                <div className="aviso-det">{a.detalle}</div>
              </details>
              )
            : (
              <div key={a.key} className={'aviso ' + a.nivel}>
                <div className="aviso-row"><span className="aviso-ico" aria-hidden>{a.icono}</span><span className="aviso-tit">{a.titulo}</span></div>
              </div>
              )
        ))}
      </div>
    </details>
  )
}
