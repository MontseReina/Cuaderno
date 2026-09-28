import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { totalFluids, weekMode } from '../domain/nutrition'
import { CUP_ML, FLUID_TARGET, HYDRATION_TIPS, MODE_LABELS, SEAWATER_PERFUSION, SEAWATER_TARGET_ML, URINE_COLORS } from '../domain/catalogs'
import { faseDelDia } from '../domain/fases'
import { DateNav } from '../components/DateNav'
import { Vaso } from '../components/Vaso'
import { Field, Section, Stepper } from '../components/ui'
import { diaTratamiento } from '../domain/diaTratamiento'

/** Hidratación por modo de semana (quimio / nadir): objetivo, desglose y color de orina. */
export default function Hidratacion() {
  const params = useParams()
  const date = params.date ?? todayStr()
  const { draft, set, setExtra, logs, toastNode } = useDailyDraft(date)
  const cycles = useRows('cycles')
  const patient = useRows('patients')[0]
  const ctx = cycleContext(cycles, date)
  // Día de perfusión (metotrexato o cisplatino + adriamicina): chupitos de agua de mar de 10 ml cada 2 h hasta terminar.
  const tramo = faseDelDia(patient?.protocol_start, cycles, date)?.tramo
  const perfusion = tramo === 'perfusion' || tramo === 'perfusion48'
  const mode = weekMode(draft, ctx)
  const target = FLUID_TARGET[mode]
  const total = totalFluids(draft)
  const level = total == null ? 'rojo' : total >= target ? 'verde' : total >= target * 0.7 ? 'amarillo' : 'rojo'
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6))
  const sum = (draft.water_ml ?? 0) + (draft.seawater_ml ?? 0) + (draft.broth_cups ?? 0) * CUP_ML + (draft.extra?.infusion_cups ?? 0) * CUP_ML
  // Botones rápidos (0.27.0): cada toque suma a su casilla (y al total si está tecleado a mano). Se puede deshacer el último.
  type Previo = Pick<typeof draft, 'water_ml' | 'seawater_ml' | 'broth_cups' | 'fluids_total_ml'> & { infusion_cups: number | null | undefined; txt: string }
  const [ultimo, setUltimo] = useState<Previo | null>(null)
  const sumar = (k: 'agua' | 'mar' | 'caldo' | 'infusion', txt: string) => {
    setUltimo({ water_ml: draft.water_ml, seawater_ml: draft.seawater_ml, broth_cups: draft.broth_cups, fluids_total_ml: draft.fluids_total_ml, infusion_cups: draft.extra?.infusion_cups, txt })
    const ml = k === 'mar' ? 10 : CUP_ML
    if (k === 'agua') set('water_ml', (draft.water_ml ?? 0) + CUP_ML)
    if (k === 'mar') set('seawater_ml', (draft.seawater_ml ?? 0) + 10)
    if (k === 'caldo') set('broth_cups', (draft.broth_cups ?? 0) + 1)
    if (k === 'infusion') setExtra({ infusion_cups: (draft.extra?.infusion_cups ?? 0) + 1 })
    if (draft.fluids_total_ml != null) set('fluids_total_ml', draft.fluids_total_ml + ml)
  }
  const deshacer = () => {
    if (!ultimo) return
    set('water_ml', ultimo.water_ml ?? null); set('seawater_ml', ultimo.seawater_ml ?? null); set('broth_cups', ultimo.broth_cups ?? null)
    set('fluids_total_ml', ultimo.fluids_total_ml ?? null); setExtra({ infusion_cups: ultimo.infusion_cups ?? null })
    setUltimo(null)
  }
  const mar = draft.seawater_ml ?? 0

  return (
    <div>
      {toastNode}
      <h1>Hidratación</h1>
      <DateNav date={date} base="/hidratacion" sub={`${diaTratamiento(patient?.protocol_start, cycles, date)?.texto ?? 'sin ciclo'}${ctx.mtxDay ? ' · metotrexato: líquidos abundantes' : ''}`} />

      <div className={'card vaso-card ' + level}>
        <Vaso total={total ?? 0} objetivo={target} nivel={level} />
        <div className="vaso-info">
          <div className="vaso-total"><strong>{total ?? 0} ml</strong> de {target} ml</div>
          <div className="muted small">{MODE_LABELS[mode]}{total != null && total < target ? ` · faltan ${target - total} ml` : total != null ? ' · objetivo cumplido' : ''}</div>
          <div className="vaso-mar small">🌊 Agua de mar: {perfusion ? <><strong>{Math.round(mar / 10)} chupito{Math.round(mar / 10) === 1 ? '' : 's'}</strong> ({mar} ml) · uno de 10 ml cada 2 h hasta terminar la perfusión</> : <><strong>{mar} de {SEAWATER_TARGET_ML} ml</strong></>}</div>
          <div className="vaso-botones">
            <button type="button" className="btn sm secondary" onClick={() => sumar('agua', '½ taza de agua')}>💧 + ½ taza de agua</button>
            <button type="button" className="btn sm secondary" onClick={() => sumar('mar', 'chupito de agua de mar')}>🌊 + chupito de mar</button>
            <button type="button" className="btn sm secondary" onClick={() => sumar('caldo', '½ taza de caldo')}>🍲 + ½ taza de caldo</button>
            <button type="button" className="btn sm secondary" onClick={() => sumar('infusion', '½ taza de manzanilla')}>🌼 + ½ taza de manzanilla</button>
          </div>
          {ultimo && <button type="button" className="linkbtn small" onClick={deshacer}>↩︎ Deshacer «{ultimo.txt}»</button>}
        </div>
        {ctx.mtxDay && <div className="small vaso-nota">Día de metotrexato: además del objetivo, pH de orina &gt; 7 y micciones frecuentes (se anotan en Signos y síntomas).</div>}
      </div>

      <Section title={`Consejos · ${MODE_LABELS[mode].toLowerCase()}`} open>
        {HYDRATION_TIPS[mode].map((t) => <div key={t} className="small" style={{ margin: '.25rem 0' }}>• {t}</div>)}
      </Section>

      <Section title="Qué ha bebido hoy" open>
        <div className="notice small"><strong>0 también es un dato:</strong> en agua, agua de mar, caldo y manzanilla, pon 0 si no ha tomado nada. Dejarlo en blanco significa «no apuntado».</div>
        <p className="muted small">Media taza = {CUP_ML} ml; chupito de agua de mar = 10 ml. Los botones de arriba suman aquí; si algo no cuadra, se corrige a mano. Si no se teclea el total, se suma solo.</p>
        <div className="grid2">
          <Field label="Agua (ml)"><input type="number" inputMode="numeric" step={100} min={0} value={draft.water_ml ?? ''} onChange={(e) => set('water_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label={perfusion ? 'Agua de mar (ml) · día de perfusión' : `Agua de mar (ml) · objetivo ${SEAWATER_TARGET_ML} ml al día`} hint={perfusion ? `Hoy: ${SEAWATER_PERFUSION}.` : undefined}><input type="number" inputMode="numeric" step={10} min={0} value={draft.seawater_ml ?? ''} onChange={(e) => set('seawater_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Caldo de Santa Paciencia (medias tazas)"><Stepper value={draft.broth_cups} onChange={(v) => set('broth_cups', v)} /></Field>
          <Field label="Manzanilla / jengibre (medias tazas)"><Stepper value={draft.extra?.infusion_cups} onChange={(v) => setExtra({ infusion_cups: v })} /></Field>
        </div>
        <Field label="Total del día (ml)" hint={draft.fluids_total_ml == null ? `Suma automática: ${sum} ml` : 'Tecleado a mano (borra para volver a la suma automática)'}>
          <input type="number" inputMode="numeric" step={CUP_ML} min={0} value={draft.fluids_total_ml ?? ''} placeholder={String(sum)} onChange={(e) => set('fluids_total_ml', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      </Section>


      <Section title="Última semana">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Día</th><th>Modo</th><th>Total</th><th>Agua</th><th>Mar</th><th>Caldo</th><th>Infus.</th><th>Orina</th></tr></thead>
            <tbody>
              {days.map((d) => {
                const l = byDate.get(d)
                const m = weekMode(l, cycleContext(cycles, d))
                const t = totalFluids(l)
                const lv = t == null ? '' : t >= FLUID_TARGET[m] ? 'verde' : t >= FLUID_TARGET[m] * 0.7 ? 'amarillo' : 'rojo'
                return (
                  <tr key={d}>
                    <td><Link to={`/hidratacion/${d}`}>{fmtDate(d)}</Link></td>
                    <td className="small">{l ? m : '—'}</td>
                    <td>{lv && <span className={'dot ' + lv} />}{t ?? '—'}</td>
                    <td className="small">{l?.water_ml ?? '—'}</td>
                    <td className="small">{l?.seawater_ml ?? '—'}</td>
                    <td className="small">{l?.broth_cups ?? '—'}</td>
                    <td className="small">{l?.extra?.infusion_cups ?? '—'}</td>
                    <td>{l?.urine_color ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: URINE_COLORS[l.urine_color - 1], border: '1px solid #ccc' }} /> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
