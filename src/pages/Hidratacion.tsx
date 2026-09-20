import { Link, useParams } from 'react-router-dom'
import { useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import type { WeekMode } from '../store/types'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext } from '../domain/cycle'
import { totalFluids, weekMode } from '../domain/nutrition'
import { CUP_ML, FLUID_TARGET, HYDRATION_TIPS, MODE_LABELS, SEAWATER_TARGET_ML, URINE_COLORS, URINE_LABELS } from '../domain/catalogs'
import { DateNav } from '../components/DateNav'
import { Field, Section, Segmented, Stepper } from '../components/ui'

/** Hidratación por modo de semana (quimio / nadir): objetivo, desglose y color de orina. */
export default function Hidratacion() {
  const params = useParams()
  const date = params.date ?? todayStr()
  const { draft, set, setExtra, logs, toastNode } = useDailyDraft(date)
  const cycles = useRows('cycles')
  const ctx = cycleContext(cycles, date)
  const mode = weekMode(draft, ctx)
  const autoMode = weekMode({ ...draft, extra: { ...draft.extra, mode: undefined } }, ctx)
  const target = FLUID_TARGET[mode]
  const total = totalFluids(draft)
  const pct = total != null ? Math.min(100, Math.round((total / target) * 100)) : 0
  const level = total == null ? 'rojo' : total >= target ? 'verde' : total >= target * 0.7 ? 'amarillo' : 'rojo'
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6))
  const sum = (draft.water_ml ?? 0) + (draft.seawater_ml ?? 0) + (draft.broth_cups ?? 0) * CUP_ML + (draft.extra?.infusion_cups ?? 0) * CUP_ML

  return (
    <div>
      {toastNode}
      <h1>Hidratación</h1>
      <DateNav date={date} base="/hidratacion" sub={ctx.cycle ? `Ciclo ${ctx.cycle.number} · D${ctx.day}${ctx.mtxDay ? ' · metotrexato: líquidos abundantes' : ''}` : 'sin ciclo'} />

      <div className={'traffic ' + level} style={{ padding: '.6rem .9rem' }}>
        <strong>{total ?? 0} ml de {target} ml</strong> · {MODE_LABELS[mode]}
        <div style={{ height: 10, background: 'rgba(255,255,255,.35)', borderRadius: 5, marginTop: '.4rem' }}><div style={{ width: `${pct}%`, height: 10, background: '#fff', borderRadius: 5 }} /></div>
        {ctx.mtxDay && <div className="small" style={{ marginTop: '.3rem' }}>Día de metotrexato: además del objetivo, pH de orina &gt; 7 y micciones frecuentes (se anotan en el Diario).</div>}
      </div>

      <Section title="Modo de la semana" open={false}>
        <Segmented
          options={(['quimio', 'nadir'] as WeekMode[]).map((m) => ({ value: m, label: `${MODE_LABELS[m]} · ${FLUID_TARGET[m]} ml` }))}
          value={mode}
          onChange={(v) => setExtra({ mode: v && v !== autoMode ? v : undefined })}
        />
        <p className="muted small">El modo es el mismo que en Nutrición. Objetivos orientativos, pendientes de validar con la nutricionista.</p>
      </Section>

      <Section title="Qué ha bebido hoy" open>
        <p className="muted small">Media taza = {CUP_ML} ml. Si no se teclea el total, se suma solo.</p>
        <div className="grid2">
          <Field label="Agua (ml)"><input type="number" inputMode="numeric" step={100} min={0} value={draft.water_ml ?? ''} onChange={(e) => set('water_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label={`Agua de mar (ml) · chupitos, objetivo ${SEAWATER_TARGET_ML}`}><input type="number" inputMode="numeric" step={10} min={0} value={draft.seawater_ml ?? ''} onChange={(e) => set('seawater_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Caldo de Santa Paciencia (medias tazas)"><Stepper value={draft.broth_cups} onChange={(v) => set('broth_cups', v)} /></Field>
          <Field label="Manzanilla / jengibre (medias tazas)"><Stepper value={draft.extra?.infusion_cups} onChange={(v) => setExtra({ infusion_cups: v })} /></Field>
        </div>
        <Field label="Total del día (ml)" hint={draft.fluids_total_ml == null ? `Suma automática: ${sum} ml` : 'Tecleado a mano (borra para volver a la suma automática)'}>
          <input type="number" inputMode="numeric" step={CUP_ML} min={0} value={draft.fluids_total_ml ?? ''} placeholder={String(sum)} onChange={(e) => set('fluids_total_ml', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
        <Field label="Color de la orina (el mismo que en el Diario)">
          <div className="urine">
            {URINE_COLORS.map((c, i) => (
              <button key={i} type="button" title={URINE_LABELS[i]} style={{ background: c }} className={draft.urine_color === i + 1 ? 'on' : ''} onClick={() => set('urine_color', draft.urine_color === i + 1 ? null : i + 1)} />
            ))}
          </div>
          {draft.urine_color && <div className="muted small">{URINE_LABELS[draft.urine_color - 1]}{draft.urine_color >= 4 ? ' → beber más y vigilar' : ''}</div>}
        </Field>
      </Section>

      <Section title={`Consejos · ${MODE_LABELS[mode].toLowerCase()}`} open>
        {HYDRATION_TIPS[mode].map((t) => <div key={t} className="small" style={{ margin: '.25rem 0' }}>• {t}</div>)}
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
