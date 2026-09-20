import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { currentPatientId, remove, save, useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import type { Meal, MealMacros, MealSlot, WeekMode, WeightEntry } from '../store/types'
import { addDays, fmtDate, fmtDateTime, nowLocalInput, todayStr } from '../domain/dates'
import { cycleContext, isCisplatinDay } from '../domain/cycle'
import { breakfastTime, carbProfile, dayNutrition, fastingHours, meanIntake, mealTraffic, slotsForMode, totalFluids, weekMode, isFatSlot } from '../domain/nutrition'
import { CARB_HELP, FAT_EXAMPLES, FRACTION_LABELS, MACRO_OPTS, MEALS_TARGET, MODE_LABELS, WEIGHT_SOURCES } from '../domain/catalogs'
import { DateNav } from '../components/DateNav'
import { Field, Section, Segmented } from '../components/ui'

/** Pilar 6 · Nutrición: registro por comida según el modo de la semana (quimio / nadir), ayuno,
 *  estimación del plato (verdura · proteína · almidón · grasa) con semáforo, semáforo del día y peso. */
export default function Nutricion() {
  const params = useParams()
  const date = params.date ?? todayStr()
  const { draft, set, setExtra, logs, toastNode } = useDailyDraft(date)
  const cycles = useRows('cycles')
  const ctx = cycleContext(cycles, date)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const yesterday = byDate.get(addDays(date, -1))
  const mode = weekMode(draft, ctx)
  const autoMode = weekMode({ ...draft, extra: { ...draft.extra, mode: undefined } }, ctx)
  const cisplatin = isCisplatinDay(ctx)
  const slots = slotsForMode(mode)
  const day = dayNutrition(draft, mode, { cisplatin })
  const fast = fastingHours(draft, yesterday)
  const bk = breakfastTime(draft)
  const [showWeights, setShowWeights] = useState(false)

  const meal = (slot: string) => draft.meals.find((m) => m.slot === slot)
  const setMeal = (slot: MealSlot, patch: Partial<Meal>) => {
    const meals = [...draft.meals]
    const i = meals.findIndex((m) => m.slot === slot)
    const base: Meal = i >= 0 ? meals[i] : { slot }
    const next = { ...base, ...patch }
    if (!next.time && (patch.fraction != null || patch.carb || patch.macros)) next.time = new Date().toTimeString().slice(0, 5)
    if (i >= 0) meals[i] = next
    else meals.push(next)
    set('meals', meals)
  }
  const setMacro = (slot: MealSlot, patch: Partial<MealMacros>) => setMeal(slot, { macros: { ...(meal(slot)?.macros ?? {}), ...patch } })

  // Variabilidad de horarios: desayunos de la última semana.
  const lastBreakfasts = Array.from({ length: 7 }, (_, i) => byDate.get(addDays(date, -i - 1))).map((l) => breakfastTime(l)).filter((t): t is string => !!t)

  return (
    <div>
      {toastNode}
      <h1>Nutrición</h1>
      <DateNav date={date} base="/nutricion" sub={ctx.cycle ? `Ciclo ${ctx.cycle.number} · D${ctx.day}${cisplatin ? ' · día de cisplatino' : ''}` : 'sin ciclo'} />

      <div className={'traffic ' + day.level} style={{ padding: '.6rem .9rem' }}>
        <strong>{day.level === 'verde' ? 'VERDE — objetivos del día cumplidos' : day.level === 'amarillo' ? 'AMARILLO — casi' : 'ROJO — lejos de la pauta'}</strong>
        <div className="small">
          {day.meals}/{day.target} comidas{day.fatTarget ? ` · ${day.fatSnacks}/${day.fatTarget} snacks de grasa` : ''} · {day.greens} platos en verde · líquidos {day.fluids ?? '—'} ml (objetivo {day.fluidTarget})
          {day.reasons.length > 0 && <div>{day.reasons.join(' · ')}</div>}
        </div>
      </div>

      <Section title="Modo de la semana y ayuno" open>
        <Field label="Modo" hint={draft.extra?.mode ? `Elegido a mano (por el ciclo sería "${MODE_LABELS[autoMode]}")` : 'Se deduce del ciclo: quimio = en ciclo y D0-D6; nadir = desde D7. Se puede forzar.'}>
          <Segmented
            options={(['quimio', 'nadir'] as WeekMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            value={mode}
            onChange={(v) => setExtra({ mode: v && v !== autoMode ? v : undefined })}
          />
        </Field>
        <p className="muted small">
          {mode === 'quimio'
            ? 'Semana de quimio: 3-4 comidas, lo que tolere, fácil de digerir; todo cocido. Metotrexato: desayunar antes, perfusión 2-3 h después y no comer hasta terminar. Cisplatino: menos hidrato y grasa (pescado y verdura cocida).'
            : 'Semana nadir: 6 comidas; la 5ª y la 6ª son snacks de pura grasa (batido con aceite de coco, macadamias, puré con ghee…). Plato: ½ verdura cocida · ⅓ proteína · ¼ almidón resistente + grasas "invisibles".'}
        </p>
        <div className="grid2">
          <Field label="Horas de ayuno (noche)" hint={draft.extra?.fasting_h != null ? 'Tecleadas a mano' : fast != null ? 'Calculadas: última comida de ayer → primera de hoy' : 'Se calculan al poner horas a las comidas'}>
            <input type="number" inputMode="decimal" step="0.5" min={0} max={48} value={draft.extra?.fasting_h ?? fast ?? ''} onChange={(e) => setExtra({ fasting_h: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Hora del desayuno" hint={lastBreakfasts.length ? `Últimos días: ${lastBreakfasts.join(', ')}` : 'Para ver la variabilidad de horarios'}>
            <input type="time" value={bk ?? ''} onChange={(e) => setMeal('desayuno', { time: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title={`Comidas · ${MODE_LABELS[mode].toLowerCase()} (${day.meals}/${MEALS_TARGET[mode].min})`} open right={<span className="tag gray">{carbProfile(draft.meals)}</span>}>
        <p className="muted small">Por cada comida: cuánto se comió del plato y qué había (verdura cocida, proteína, almidón, grasa añadida). El semáforo compara con la pauta de la nutricionista. Las fotos del antes y después llegarán en el siguiente bloque.</p>
        {slots.map((s) => {
          const m = meal(s.key)
          const check = m ? mealTraffic(m, { cisplatin }) : null
          const fat = isFatSlot(s.key)
          return (
            <div key={s.key} className="card tight" style={{ marginBottom: '.5rem' }}>
              <div className="row between">
                <div className="mealhead">{check && <span className={'dot ' + check.level} />}<strong>{s.label}</strong></div>
                <input type="time" style={{ width: 'auto' }} value={m?.time ?? ''} onChange={(e) => setMeal(s.key as MealSlot, { time: e.target.value })} />
              </div>
              <Segmented
                options={([0, 0.25, 0.5, 0.75, 1] as const).map((f) => ({ value: f, label: FRACTION_LABELS[String(f)] }))}
                value={m?.fraction}
                onChange={(v) => setMeal(s.key as MealSlot, { fraction: v ?? undefined })}
              />
              {fat ? (
                <div className="macros">
                  <Field label="Snack de pura grasa (batido con aceite de coco, macadamias, puré con ghee…)">
                    <Segmented options={[{ value: 'si', label: 'Sí, grasa' }, { value: 'no', label: 'No era de grasa' }]} value={m?.macros?.fat == null ? null : m.macros.fat ? 'si' : 'no'} onChange={(v) => setMacro(s.key as MealSlot, { fat: v == null ? undefined : v === 'si' })} />
                  </Field>
                </div>
              ) : (
                <div className="macros">
                  <Field label="Verdura cocida (objetivo ≈ ½ plato)"><Segmented options={[...MACRO_OPTS.veg]} value={m?.macros?.veg} onChange={(v) => setMacro(s.key as MealSlot, { veg: v ?? undefined })} /></Field>
                  <Field label="Proteína (objetivo ≈ ⅓: pescado, huevo, pollo, paté de sardinas…)"><Segmented options={[...MACRO_OPTS.prot]} value={m?.macros?.prot} onChange={(v) => setMacro(s.key as MealSlot, { prot: v ?? undefined })} /></Field>
                  <Field label={cisplatin ? 'Almidón resistente (hoy, cisplatino: poco)' : 'Almidón resistente (objetivo ≈ ¼: quinoa, patata o boniato enfriados, arroz)'}><Segmented options={[...MACRO_OPTS.starch]} value={m?.macros?.starch} onChange={(v) => setMacro(s.key as MealSlot, { starch: v ?? undefined })} /></Field>
                  <Field label="Grasa añadida" hint={FAT_EXAMPLES}>
                    <Segmented options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} value={m?.macros?.fat == null ? null : m.macros.fat ? 'si' : 'no'} onChange={(v) => setMacro(s.key as MealSlot, { fat: v == null ? undefined : v === 'si' })} />
                  </Field>
                </div>
              )}
              {check && check.level !== 'verde' && <div className="muted small" style={{ marginTop: '.3rem' }}>Falta: {check.missing.join(', ')}</div>}
              <details style={{ marginTop: '.4rem' }}>
                <summary className="small muted">Hidratos, textura y qué comió</summary>
                <div style={{ marginTop: '.3rem' }}>
                  <Segmented options={(['sin', 'baja', 'media', 'alta'] as const).map((c) => ({ value: c, label: CARB_HELP[c].label }))} value={m?.carb} onChange={(v) => setMeal(s.key as MealSlot, { carb: v ?? undefined })} />
                  {m?.carb && <div className="muted small">{CARB_HELP[m.carb].help}</div>}
                </div>
                <div className="row" style={{ marginTop: '.4rem' }}>
                  <select style={{ width: 'auto' }} value={m?.texture ?? ''} onChange={(e) => setMeal(s.key as MealSlot, { texture: (e.target.value || undefined) as Meal['texture'] })}>
                    <option value="">Textura…</option>
                    <option value="normal">Normal</option>
                    <option value="blando">Blando</option>
                    <option value="triturado">Triturado</option>
                    <option value="liquido">Líquido</option>
                  </select>
                  <input type="text" placeholder="Qué comió (opcional)" value={m?.note ?? ''} onChange={(e) => setMeal(s.key as MealSlot, { note: e.target.value })} style={{ flex: 1 }} />
                </div>
              </details>
            </div>
          )
        })}
        <div className="muted small">Ingesta media: {meanIntake(draft.meals) != null ? Math.round(meanIntake(draft.meals)! * 100) + ' %' : '—'} · Líquidos: {totalFluids(draft) ?? '—'} ml → <Link to={`/hidratacion/${date}`}>Hidratación</Link></div>
      </Section>

      <Section title="Peso y altura" open={showWeights} right={<button className="btn sm ghost" onClick={(e) => { e.preventDefault(); setShowWeights(true) }}>+</button>}>
        <Weights open={showWeights} />
      </Section>

      <Section title="Últimos 14 días">
        <Trend date={date} />
      </Section>

      <Section title="Pauta de la nutricionista (10-sept-2026)">
        <p className="small"><strong>Siempre:</strong> todo cocido, nada crudo. Base: caldo de verduras + caldo de huesos. Agua + chupitos de agua de mar; manzanilla y jengibre sin limón.</p>
        <p className="small"><strong>Invisibles en todas las comidas:</strong> {FAT_EXAMPLES}.</p>
        <p className="small"><strong>Imprescindibles:</strong> pescado, verdura de fibra soluble, shiitake, quinoa, omega-3 (coco, aguacate), frutos rojos, paté de sardinas + hígado de bacalao.</p>
        <p className="small"><strong>Plato:</strong> ½ verdura cocida · ⅓ proteína · ¼ almidón resistente (menos en cisplatino) · grasas por encima.</p>
        <p className="muted small">Los umbrales de los semáforos son una propuesta a validar con la nutricionista.</p>
      </Section>
    </div>
  )
}

function Weights({ open }: { open: boolean }) {
  const weights = useRows('weights').sort((a, b) => b.at.localeCompare(a.at))
  const [w, setW] = useState<Partial<WeightEntry>>({ at: nowLocalInput(), source: 'inbody' })
  const [adding, setAdding] = useState(open)
  const last = weights[0]
  const lastH = weights.find((x) => x.height_cm)?.height_cm
  return (
    <div>
      {last && <p className="small">Última: <strong>{last.kg} kg</strong> · {fmtDateTime(last.at)} · {WEIGHT_SOURCES.find((s) => s.value === last.source)?.label}{lastH ? ` · altura ${lastH} cm` : ''}{last.muscle_kg ? ` · músculo ${last.muscle_kg} kg` : ''}{last.fat_pct ? ` · grasa ${last.fat_pct} %` : ''}</p>}
      {(adding || open) && (
        <div className="card tight">
          <div className="grid2">
            <Field label="Fecha y hora"><input type="datetime-local" value={w.at ?? ''} onChange={(e) => setW({ ...w, at: e.target.value })} /></Field>
            <Field label="Peso (kg)"><input type="number" inputMode="decimal" step="0.1" min={5} max={150} value={w.kg ?? ''} onChange={(e) => setW({ ...w, kg: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          </div>
          <Field label="Báscula">
            <Segmented options={WEIGHT_SOURCES} value={w.source} onChange={(v) => setW({ ...w, source: v ?? 'casa' })} />
          </Field>
          <div className="grid2">
            <Field label="Altura (cm)"><input type="number" inputMode="decimal" step="0.5" min={50} max={220} value={w.height_cm ?? ''} onChange={(e) => setW({ ...w, height_cm: e.target.value === '' ? null : Number(e.target.value) })} placeholder={lastH ? String(lastH) : ''} /></Field>
            {w.source === 'inbody' && <Field label="Masa muscular (kg)"><input type="number" inputMode="decimal" step="0.1" value={w.muscle_kg ?? ''} onChange={(e) => setW({ ...w, muscle_kg: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
            {w.source === 'inbody' && <Field label="Grasa (%)"><input type="number" inputMode="decimal" step="0.1" value={w.fat_pct ?? ''} onChange={(e) => setW({ ...w, fat_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
            {w.source === 'inbody' && <Field label="Agua corporal (%)"><input type="number" inputMode="decimal" step="0.1" value={w.water_pct ?? ''} onChange={(e) => setW({ ...w, water_pct: e.target.value === '' ? null : Number(e.target.value) })} /></Field>}
          </div>
          <Field label="Notas"><input type="text" value={w.notes ?? ''} onChange={(e) => setW({ ...w, notes: e.target.value })} /></Field>
          <div className="row">
            <button className="btn sm" disabled={!w.kg || !w.at} onClick={async () => { await save('weights', { ...w, patient_id: currentPatientId() } as WeightEntry); setW({ at: nowLocalInput(), source: w.source }); setAdding(false) }}>Guardar pesada</button>
          </div>
        </div>
      )}
      {!adding && !open && <button className="btn sm secondary" onClick={() => setAdding(true)}>+ Nueva pesada</button>}
      {weights.length > 1 && (
        <div style={{ marginTop: '.5rem' }}>
          <div className="spark">{[...weights].reverse().slice(-12).map((x, _, arr) => { const min = Math.min(...arr.map((y) => y.kg)) - 1; const max = Math.max(...arr.map((y) => y.kg)); return <span key={x.id} style={{ height: `${Math.max(4, ((x.kg - min) / (max - min || 1)) * 40)}px` }} title={`${fmtDateTime(x.at)}: ${x.kg} kg`} /> })}</div>
        </div>
      )}
      {weights.slice(0, 8).map((x) => (
        <div className="item" key={x.id}>
          <div className="main">
            <div>{x.kg} kg <span className="tag gray">{WEIGHT_SOURCES.find((s) => s.value === x.source)?.label}</span></div>
            <div className="meta">{fmtDateTime(x.at)}{x.height_cm ? ` · ${x.height_cm} cm` : ''}{x.muscle_kg ? ` · músculo ${x.muscle_kg} kg` : ''}{x.fat_pct ? ` · grasa ${x.fat_pct} %` : ''}{x.notes ? ` · ${x.notes}` : ''}</div>
          </div>
          <button className="btn sm ghost" onClick={() => { if (confirm('¿Borrar esta pesada?')) remove('weights', x.id) }}>✕</button>
        </div>
      ))}
    </div>
  )
}

function Trend({ date }: { date: string }) {
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13))
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Día</th><th>Modo</th><th>Comidas</th><th>Ayuno</th><th>Desayuno</th><th>Líquidos</th><th>Día</th></tr></thead>
        <tbody>
          {days.map((d) => {
            const l = byDate.get(d)
            const c = cycleContext(cycles, d)
            const m = weekMode(l, c)
            const n = l ? dayNutrition(l, m, { cisplatin: isCisplatinDay(c) }) : null
            const f = fastingHours(l, byDate.get(addDays(d, -1)))
            return (
              <tr key={d}>
                <td><Link to={`/nutricion/${d}`}>{fmtDate(d)}</Link></td>
                <td className="small">{l ? (m === 'quimio' ? 'quimio' : 'nadir') : '—'}</td>
                <td>{n ? `${n.meals}/${n.target}` : '—'}</td>
                <td className="small">{f != null ? `${f} h` : '—'}</td>
                <td className="small">{breakfastTime(l) ?? '—'}</td>
                <td className="small">{totalFluids(l) ?? '—'}</td>
                <td>{n ? <span className={'dot ' + n.level} /> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
