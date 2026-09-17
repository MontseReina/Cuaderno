import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { backend, currentPatientId, save, useRows } from '../store'
import type { DailyLog, Meal, MealSlot } from '../store/types'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext, dailyTraffic, symptomsForToday } from '../domain/cycle'
import {
  ACTIVITIES, BRISTOL_HELP, CARB_HELP, CUP_ML, FATIGUE_LABELS, FRACTION_LABELS, MEAL_SLOTS, MOOD_FACES,
  PREVENTIVE, SEVERITY_LABELS, STOOL_COLORS, URINE_COLORS, URINE_LABELS, WAKEUP_CAUSES, DRUG_WATCH, DRUG_LABELS,
} from '../domain/catalogs'
import { carbProfile, eatingWindow, meanIntake, overnightFast } from '../domain/nutrition'
import { Check, Faces, Field, Section, Segmented, Severity, Stepper, useToast } from '../components/ui'

const emptyLog = (date: string): Omit<DailyLog, keyof import('../store/types').BaseRow> & { date: string } => ({
  date, symptoms: {}, preventive: {}, meals: [], activity: {},
})

export default function Diario() {
  const params = useParams()
  const nav = useNavigate()
  const date = params.date ?? todayStr()
  const logs = useRows('daily_logs')
  const cycles = useRows('cycles')
  const diagnoses = useRows('diagnoses')
  const patient = backend.all('patients')[0]
  const existing = logs.find((l) => l.date === date)
  const [draft, setDraft] = useState<DailyLog>(() => ({ ...(emptyLog(date) as DailyLog), ...(existing ?? {}) }))
  const { toast, node } = useToast()
  const dirty = useRef(false)

  useEffect(() => {
    setDraft({ ...(emptyLog(date) as DailyLog), ...(existing ?? {}) })
    dirty.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id])

  // Autoguardado 800 ms después del último cambio.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(async () => {
      const saved = await save('daily_logs', { ...draft, patient_id: currentPatientId(), date })
      if (!draft.id) setDraft((d) => ({ ...d, id: saved.id }))
      dirty.current = false
      toast('Guardado')
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const set = useCallback(<K extends keyof DailyLog>(k: K, v: DailyLog[K]) => {
    dirty.current = true
    setDraft((d) => ({ ...d, [k]: v }))
  }, [])

  const ctx = cycleContext(cycles, date)
  const defs = symptomsForToday(ctx, diagnoses)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const prev = [1, 2, 3].map((n) => byDate.get(addDays(date, -n))).filter((l): l is DailyLog => !!l)
  const traffic = dailyTraffic(draft, prev, ctx, defs)
  const hasCatheter = !!patient?.catheter_type
  const preventive = PREVENTIVE.filter((p) => !p.when || p.when === 'siempre' || (p.when === 'nadir' && ctx.nadir) || (p.when === 'cateter' && hasCatheter) || (p.when === 'mtx' && ctx.mtxDay))
  const groups = useMemo(() => Array.from(new Set(preventive.map((p) => p.group))), [preventive])
  const symptomsMarked = Object.values(draft.symptoms).filter((v) => v > 0).length
  const prevDone = preventive.filter((p) => draft.preventive[p.key]).length
  const win = eatingWindow(draft.meals)
  const fast = overnightFast(draft, byDate.get(addDays(date, -1)))

  const setMeal = (slot: MealSlot, patch: Partial<Meal>) => {
    const meals = [...draft.meals]
    const i = meals.findIndex((m) => m.slot === slot)
    const base: Meal = i >= 0 ? meals[i] : { slot }
    const next = { ...base, ...patch }
    if (!next.time && (patch.fraction != null || patch.carb)) next.time = new Date().toTimeString().slice(0, 5)
    if (i >= 0) meals[i] = next
    else meals.push(next)
    set('meals', meals)
  }
  const meal = (slot: string) => draft.meals.find((m) => m.slot === slot)

  return (
    <div>
      {node}
      <div className="row between" style={{ marginBottom: '.6rem' }}>
        <button className="btn sm ghost" onClick={() => nav(`/diario/${addDays(date, -1)}`)}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <strong>{date === todayStr() ? 'Hoy' : fmtDate(date)}</strong>
          <div className="muted small">
            {ctx.cycle ? `Ciclo ${ctx.cycle.number} · D${ctx.day} · ${ctx.inCycle ? 'en ciclo' : ctx.nadir ? 'valle D7-14' : 'fuera de ciclo'}` : 'sin ciclo'}
          </div>
        </div>
        <button className="btn sm ghost" disabled={date >= todayStr()} onClick={() => nav(`/diario/${addDays(date, 1)}`)}>›</button>
      </div>

      <div className={'traffic ' + traffic.level} style={{ padding: '.6rem .9rem' }}>
        <strong>
          {traffic.level === 'rojo' ? 'ROJO: llamar a oncología / urgencias' : traffic.level === 'amarillo' ? 'AMARILLO: vigilar y consultar hoy' : 'Verde'}
        </strong>
        {traffic.reasons.length > 0 && <div className="small">{traffic.reasons.join(' · ')}</div>}
        {traffic.level === 'rojo' && patient?.phone_oncology && <div><a href={`tel:${patient.phone_oncology}`} style={{ color: 'inherit' }}>📞 {patient.phone_oncology}</a></div>}
      </div>

      <Section title="Dónde está y constantes" open>
        <Segmented
          options={[{ value: 'casa', label: 'Casa' }, { value: 'ingreso', label: 'Ingreso' }, { value: 'hospital_dia', label: 'Hospital de día' }]}
          value={draft.location}
          onChange={(v) => set('location', v ?? undefined)}
        />
        <div className="grid2">
          <Field label="Temperatura máx. (°C)">
            <input type="number" inputMode="decimal" step="0.1" min={34} max={43} value={draft.temp_max ?? ''} onChange={(e) => set('temp_max', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Peso (kg) — 2 veces por semana">
            <input type="number" inputMode="decimal" step="0.1" min={0} value={draft.weight ?? ''} onChange={(e) => set('weight', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Color de la orina">
          <div className="urine">
            {URINE_COLORS.map((c, i) => (
              <button key={i} type="button" title={URINE_LABELS[i]} style={{ background: c }} className={draft.urine_color === i + 1 ? 'on' : ''} onClick={() => set('urine_color', draft.urine_color === i + 1 ? null : i + 1)} />
            ))}
          </div>
          {draft.urine_color && <div className="muted small">{URINE_LABELS[draft.urine_color - 1]}</div>}
        </Field>
        <Field label="Cantidad de orina">
          <Segmented options={[{ value: 'menos', label: 'Menos de lo habitual' }, { value: 'normal', label: 'Normal' }, { value: 'mas', label: 'Más' }]} value={draft.urine_amount} onChange={(v) => set('urine_amount', v)} />
        </Field>
        {(ctx.mtxDay || draft.location === 'ingreso') && (
          <div className="grid3">
            <Field label="Micciones (nº)"><Stepper value={draft.urine_count} onChange={(v) => set('urine_count', v)} /></Field>
            <Field label="Orina (ml)"><input type="number" inputMode="numeric" value={draft.urine_ml ?? ''} onChange={(e) => set('urine_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label="pH orina"><input type="number" inputMode="decimal" step="0.5" value={draft.urine_ph ?? ''} onChange={(e) => set('urine_ph', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          </div>
        )}
        <div className="grid2">
          <Field label="Deposiciones (nº)"><Stepper value={draft.stools_n} onChange={(v) => set('stools_n', v)} /></Field>
          <Field label="Bristol (1-7)">
            <Stepper value={draft.bristol} onChange={(v) => set('bristol', v)} min={1} max={7} />
            {draft.bristol ? <div className="muted small">{BRISTOL_HELP[draft.bristol]}</div> : null}
          </Field>
        </div>
        <Field label="Color de las heces">
          <Segmented options={STOOL_COLORS.map((s) => ({ value: s.key, label: s.label }))} value={draft.stool_color ?? null} onChange={(v) => set('stool_color', v as DailyLog['stool_color'])} />
        </Field>
        <Field label={`Dolor máximo del día: ${draft.pain_max ?? '—'} / 10`}>
          <input type="range" min={0} max={10} value={draft.pain_max ?? 0} onChange={(e) => set('pain_max', Number(e.target.value))} style={{ width: '100%' }} />
          <input type="text" placeholder="¿Dónde?" value={draft.pain_location ?? ''} onChange={(e) => set('pain_location', e.target.value)} />
        </Field>
        <Field label="Fatiga">
          <Segmented options={FATIGUE_LABELS.map((l, i) => ({ value: i, label: l }))} value={draft.fatigue} onChange={(v) => set('fatigue', v)} />
        </Field>
        <Field label="Ánimo del niño hoy">
          <Faces value={draft.mood_child} onChange={(v) => set('mood_child', v)} faces={MOOD_FACES} />
        </Field>
      </Section>

      <Section title={`Síntomas y signos (${symptomsMarked} marcados)`} open right={<span className="tag gray">{ctx.inCycle ? 'lista en ciclo' : 'lista fuera de ciclo'}</span>}>
        <p className="muted small">Marca solo lo que hay. Lo que no se toca cuenta como "No".</p>
        {defs.map((d) => (
          <div key={d.key} style={{ margin: '.5rem 0' }}>
            <div className="small" style={{ marginBottom: '.2rem' }}>{d.label}</div>
            <Severity value={draft.symptoms[d.key]} onChange={(v) => set('symptoms', { ...draft.symptoms, [d.key]: v })} labels={SEVERITY_LABELS} />
            {d.help && (draft.symptoms[d.key] ?? 0) > 0 && <div className="muted small">{d.help}</div>}
          </div>
        ))}
        {ctx.cycle && ctx.inCycle && ctx.cycle.drugs.some((dr) => DRUG_WATCH[dr]?.length) && (
          <div className="notice">
            <strong>Vigilancia de estos días</strong>
            {ctx.cycle.drugs.map((dr) => (
              <div key={dr} className="small">{DRUG_LABELS[dr]}: {DRUG_WATCH[dr].join(' · ')}</div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Cuidados preventivos (${prevDone}/${preventive.length})`}>
        {patient?.catheter_last_dressing && <p className="muted small">Última cura del catéter: {fmtDate(patient.catheter_last_dressing)}{patient.catheter_dressing_days ? ` · siguiente ${fmtDate(addDays(patient.catheter_last_dressing, patient.catheter_dressing_days))}` : ''}</p>}
        {groups.map((g) => (
          <div key={g}>
            <h3>{g}</h3>
            {preventive.filter((p) => p.group === g).map((p) => (
              <Check key={p.key} checked={!!draft.preventive[p.key]} onChange={(v) => set('preventive', { ...draft.preventive, [p.key]: v })}>{p.label}</Check>
            ))}
          </div>
        ))}
      </Section>

      <Section title="Comidas" right={<span className="tag gray">{carbProfile(draft.meals)}</span>}>
        <p className="muted small">Fracción del plato servido + carga de hidratos. La hora se pone sola (se puede cambiar).</p>
        {MEAL_SLOTS.map((s) => {
          const m = meal(s.key)
          return (
            <div key={s.key} className="card tight" style={{ marginBottom: '.5rem' }}>
              <div className="row between">
                <strong>{s.label}</strong>
                <input type="time" style={{ width: 'auto' }} value={m?.time ?? ''} onChange={(e) => setMeal(s.key as MealSlot, { time: e.target.value })} />
              </div>
              <Segmented
                options={([0, 0.25, 0.5, 0.75, 1] as const).map((f) => ({ value: f, label: FRACTION_LABELS[String(f)] }))}
                value={m?.fraction}
                onChange={(v) => setMeal(s.key as MealSlot, { fraction: v ?? undefined })}
              />
              <div style={{ marginTop: '.4rem' }}>
                <Segmented
                  options={(['sin', 'baja', 'media', 'alta'] as const).map((c) => ({ value: c, label: CARB_HELP[c].label }))}
                  value={m?.carb}
                  onChange={(v) => setMeal(s.key as MealSlot, { carb: v ?? undefined })}
                />
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
                <input type="text" placeholder="Qué (opcional)" value={m?.note ?? ''} onChange={(e) => setMeal(s.key as MealSlot, { note: e.target.value })} style={{ flex: 1 }} />
              </div>
            </div>
          )
        })}
        <div className="muted small">
          Ingesta media: {meanIntake(draft.meals) != null ? Math.round(meanIntake(draft.meals)! * 100) + ' %' : '—'}
          {win && ` · Ventana de alimentación ${win.first}–${win.last} (${win.hours} h)`}
          {fast != null && ` · Ayuno nocturno ${fast} h`}
        </div>
        <details style={{ marginTop: '.5rem' }}>
          <summary className="small">¿Qué significa cada carga de hidratos?</summary>
          {Object.values(CARB_HELP).map((c) => (
            <div key={c.label} className="small"><strong>{c.label}:</strong> {c.help}</div>
          ))}
        </details>
      </Section>

      <Section title="Líquidos">
        <p className="muted small">Media taza = {CUP_ML} ml. Los caldos e infusiones también cuentan en el total.</p>
        <div className="grid2">
          <Field label="Total del día (ml)"><input type="number" inputMode="numeric" step={CUP_ML} value={draft.fluids_total_ml ?? ''} onChange={(e) => set('fluids_total_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Agua (ml)"><input type="number" inputMode="numeric" step={CUP_ML} value={draft.water_ml ?? ''} onChange={(e) => set('water_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Agua de mar (ml)"><input type="number" inputMode="numeric" step={50} value={draft.seawater_ml ?? ''} onChange={(e) => set('seawater_ml', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Caldo de Santa Paciencia (medias tazas)"><Stepper value={draft.broth_cups} onChange={(v) => set('broth_cups', v)} /></Field>
        </div>
      </Section>

      <Section title="Sueño y luz">
        <div className="grid2">
          <Field label="Se dormió a las"><input type="time" value={draft.sleep_start ?? ''} onChange={(e) => set('sleep_start', e.target.value || null)} /></Field>
          <Field label="Se despertó a las"><input type="time" value={draft.sleep_end ?? ''} onChange={(e) => set('sleep_end', e.target.value || null)} /></Field>
          <Field label="Despertares"><Stepper value={draft.wakeups} onChange={(v) => set('wakeups', v)} /></Field>
          <Field label="Siesta (min)"><input type="number" inputMode="numeric" value={draft.nap_min ?? ''} onChange={(e) => set('nap_min', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        </div>
        {(draft.wakeups ?? 0) > 0 && (
          <Field label="Causa principal">
            <Segmented options={WAKEUP_CAUSES.map((c) => ({ value: c, label: c }))} value={draft.wakeup_cause} onChange={(v) => set('wakeup_cause', v ?? undefined)} />
          </Field>
        )}
        <Check checked={!!draft.ir_morning} onChange={(v) => set('ir_morning', v)}>Luz infrarroja por la mañana</Check>
        <Check checked={!!draft.ir_night} onChange={(v) => set('ir_night', v)}>Luz infrarroja por la noche</Check>
        <Check checked={!!draft.glasses} onChange={(v) => set('glasses', v)}>Gafas puestas correctamente por la noche</Check>
        <Check checked={!!draft.daylight_morning} onChange={(v) => set('daylight_morning', v)}>Paseo con luz natural por la mañana</Check>
        <Check checked={!!draft.daylight_afternoon} onChange={(v) => set('daylight_afternoon', v)}>Paseo con luz natural por la tarde</Check>
        <Check checked={!!draft.sun_exposure} onChange={(v) => set('sun_exposure', v)}>Exposición solar con cuidado</Check>
      </Section>

      <Section title="Actividad y pasos">
        <div className="chips">
          {ACTIVITIES.map((a) => (
            <button key={a.key} type="button" className={'chip ' + (draft.activity[a.key] ? 'on' : '')} onClick={() => set('activity', { ...draft.activity, [a.key]: !draft.activity[a.key] })}>{a.label}</button>
          ))}
        </div>
        <div className="grid2">
          <Field label="Minutos totales aprox.">
            <Segmented options={[5, 15, 30, 45, 60].map((m) => ({ value: m, label: m === 60 ? '60+' : String(m) }))} value={draft.activity_min} onChange={(v) => set('activity_min', v)} />
          </Field>
          <Field label="Pasos (del reloj del cuidador)"><input type="number" inputMode="numeric" value={draft.steps ?? ''} onChange={(e) => set('steps', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        </div>
        <p className="muted small">Fuerza y aeróbico con detalle (series, repeticiones, carga) en <Link to="/ejercicio">Ejercicio</Link>.</p>
      </Section>

      <Section title="Notas del día" open={!!draft.notes}>
        <textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Cualquier cosa que no esté en las listas…" />
        <Field label="Altura (cm) — una vez al mes"><input type="number" inputMode="decimal" value={draft.height_cm ?? ''} onChange={(e) => set('height_cm', e.target.value === '' ? null : Number(e.target.value))} /></Field>
      </Section>
    </div>
  )
}
