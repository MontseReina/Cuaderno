import type { NauseaDia, NauseaEfecto, VitalSlot } from '../store/types'
import { VITAL_SLOTS, SEVERITY_LABELS } from '../domain/catalogs'
import { NAUSEA_CARAS, NAUSEA_DESENCADENANTES, NAUSEA_EFECTO, NAUSEA_IMPIDE, nauseaMax, type ControlNivel, type FaseNausea, type ResumenSesion } from '../domain/nausea'
import { Check, Segmented, Stepper } from './ui'

const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const CONTROL_TXT: Record<ControlNivel, string> = {
  verde: 'Control completo',
  ambar: 'Control parcial',
  rojo: 'Sin control: comentar con oncología si la pauta antiemética es suficiente',
}

/** Registro de náuseas del día (Signos y síntomas): caras 0-10 por momento, impacto, arcadas, rescates y control. */
export function Nauseas({ value, legacy, fase, control, resumen, antiemeticos, onChange }: {
  value: NauseaDia
  /** Valor antiguo No/Leve/Moderado/Intenso, por si el día se apuntó antes del cambio. */
  legacy: number
  fase: FaseNausea | null
  control: { nivel: ControlNivel; motivos: string[] } | null
  resumen: ResumenSesion | null
  antiemeticos: string[]
  onChange: (n: NauseaDia) => void
}) {
  const max = nauseaMax(value)
  const upd = (patch: Partial<NauseaDia>) => onChange({ ...value, ...patch })
  const setScore = (slot: VitalSlot, v: number | null) => upd({ score: { ...(value.score ?? {}), [slot]: v } })
  const rescates = value.rescates ?? []
  const updR = (i: number, patch: Partial<{ time: string; med: string; efecto: NauseaEfecto | null }>) => upd({ rescates: rescates.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const hayAlgo = (max ?? 0) > 0 || !!value.anticipatoria
  const tocaAnticipatoria = fase?.fase === 'vispera' || (fase?.fase === 'aguda' && fase.diaTras === 0)

  return (
    <div className="nausea">
      {fase && <div className={'nausea-fase ' + fase.fase}>{fase.texto}</div>}
      {max == null && legacy > 0 && <div className="muted small">Apuntado con la escala antigua: <strong>{SEVERITY_LABELS[legacy]}</strong>. Con las caras queda más preciso.</div>}
      <div className="muted small" style={{ margin: '.2rem 0 .35rem' }}>Que él señale la cara: 0 es nada de náusea y 10, la peor que se pueda imaginar.</div>
      <div className="nausea-escala">
        {VITAL_SLOTS.map((sl) => {
          const v = value.score?.[sl.key] ?? null
          return (
            <div key={sl.key} className="nausea-fila">
              <span className="nausea-mom">{sl.label}</span>
              <div className="nausea-caras" role="group" aria-label={`Náusea por la ${sl.label.toLowerCase()}`}>
                {NAUSEA_CARAS.map((c) => (
                  <button key={c.v} type="button" className={'n' + c.v + (v === c.v ? ' on' : '')} aria-pressed={v === c.v} title={`${c.v} · ${c.txt}`} onClick={() => setScore(sl.key, v === c.v ? null : c.v)}>
                    <span className="cara" aria-hidden>{c.cara}</span><span className="num">{c.v}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {hayAlgo && (
        <>
          <div className="small" style={{ margin: '.6rem 0 .2rem' }}>¿Le ha impedido comer o beber?</div>
          <Segmented options={NAUSEA_IMPIDE.map((l, i) => ({ value: i, label: l }))} value={value.impide ?? null} onChange={(v) => upd({ impide: v as NauseaDia['impide'] })} />
          <div className="small" style={{ margin: '.6rem 0 .2rem' }}>¿Qué la ha provocado? <span className="muted">(opcional, se puede marcar más de uno)</span></div>
          <div className="row" style={{ gap: '.35rem', flexWrap: 'wrap' }}>
            {NAUSEA_DESENCADENANTES.map((d) => {
              const on = (value.desencadenantes ?? []).includes(d)
              return <button key={d} type="button" className={'chip ' + (on ? 'on' : '')} aria-pressed={on} onClick={() => upd({ desencadenantes: on ? (value.desencadenantes ?? []).filter((x) => x !== d) : [...(value.desencadenantes ?? []), d] })}>{d}</button>
            })}
          </div>
        </>
      )}
      {(hayAlgo || tocaAnticipatoria) && (
        <Check checked={!!value.anticipatoria} onChange={(v) => upd({ anticipatoria: v })}>Empezó antes de la quimio o al llegar al hospital <span className="muted small">(anticipatoria)</span></Check>
      )}

      <div className="row between" style={{ margin: '.6rem 0 .2rem', alignItems: 'center' }}>
        <span className="small">Arcadas sin vómito (nº)</span>
        <Stepper value={value.arcadas} onChange={(v) => upd({ arcadas: v })} />
      </div>

      <div className="small" style={{ margin: '.6rem 0 .2rem' }}>Rescates: dosis extra de antiemético</div>
      {rescates.length === 0 && <div className="muted small" style={{ marginBottom: '.3rem' }}>Hoy no ha hecho falta ninguno.</div>}
      {rescates.map((r, i) => (
        <div key={i} className="nausea-rescate">
          <div className="row" style={{ gap: '.4rem', flexWrap: 'nowrap' }}>
            <input type="time" value={r.time} onChange={(e) => updR(i, { time: e.target.value })} style={{ width: '7.2rem' }} />
            <input type="text" list="antiemeticos" placeholder="¿Cuál?" value={r.med} onChange={(e) => updR(i, { med: e.target.value })} style={{ flex: 1 }} />
            <button type="button" className="btn sm ghost" aria-label="Quitar este rescate" onClick={() => upd({ rescates: rescates.filter((_, j) => j !== i) })}>✕</button>
          </div>
          <div className="row" style={{ gap: '.4rem', alignItems: 'center', marginTop: '.25rem' }}>
            <span className="muted small">A la hora, ¿ha mejorado?</span>
            <Segmented options={NAUSEA_EFECTO} value={r.efecto ?? null} onChange={(v) => updR(i, { efecto: v })} />
          </div>
        </div>
      ))}
      <datalist id="antiemeticos">{antiemeticos.map((a) => <option key={a} value={a} />)}</datalist>
      <button type="button" className="btn sm secondary" onClick={() => upd({ rescates: [...rescates, { time: horaAhora(), med: antiemeticos.length === 1 ? antiemeticos[0] : '', efecto: null }] })}>+ Rescate</button>

      {control && (
        <div className={'nausea-control ' + control.nivel}>
          <strong>{CONTROL_TXT[control.nivel]}</strong>
          {control.motivos.length > 0 && <span> · {control.motivos.join(' · ')}</span>}
        </div>
      )}
      {resumen && (
        <div className="muted small" style={{ marginTop: '.35rem' }}>
          <strong>{resumen.titulo}:</strong> {resumen.texto}.
        </div>
      )}
    </div>
  )
}
