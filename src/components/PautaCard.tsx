import { useState } from 'react'
import { PAUTAS, type PautaKey, type TramoKey } from '../domain/pautas'

/** Pauta de alimentación de la semana (MTX o cisplatino + adriamicina), con el tramo de hoy marcado.
 *  Se puede ver la otra pauta con los botones de abajo. */
export function PautaCard({ auto, tramo }: { auto: PautaKey; tramo: TramoKey | null }) {
  const [ver, setVer] = useState<PautaKey>(auto)
  const p = PAUTAS[ver]
  const esHoy = ver === auto
  return (
    <details className="section pauta" open>
      <summary><span>{p.titulo}</span></summary>
      <div className="body">
        <h3 className="pauta-semana">{p.semana}</h3>
        <p className="small">{p.intro}</p>
        {p.secciones.map((s) => {
          const hoy = esHoy && !!s.tramo && s.tramo === tramo
          return (
            <div key={s.titulo} className={'pauta-sec' + (hoy ? ' hoy' : '')}>
              <h4>{s.titulo}{s.subtitulo ? <span className="muted"> ({s.subtitulo})</span> : null}{hoy && <span className="tag">hoy</span>}</h4>
              <ul>
                {s.puntos.map((pt, i) => typeof pt === 'string'
                  ? <li key={i}>{pt}</li>
                  : <li key={i}>{pt.texto}<ol>{pt.pasos.map((x) => <li key={x}>{x}</li>)}</ol></li>)}
              </ul>
            </div>
          )
        })}
        <div className="row" style={{ gap: '.4rem', marginTop: '.4rem' }}>
          <span className="muted small">Ver:</span>
          <button type="button" className={'btn sm ' + (ver === 'mtx' ? '' : 'secondary')} onClick={() => setVer('mtx')}>Metotrexato</button>
          <button type="button" className={'btn sm ' + (ver === 'cddp' ? '' : 'secondary')} onClick={() => setVer('cddp')}>Cisplatino + adriamicina</button>
        </div>
      </div>
    </details>
  )
}
