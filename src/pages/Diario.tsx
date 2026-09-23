import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { backend, useRows } from '../store'
import { useDailyDraft } from '../store/useDailyDraft'
import type { DailyLog } from '../store/types'
import { addDays, fmtDate, todayStr } from '../domain/dates'
import { cycleContext, dailyTraffic, symptomsForToday } from '../domain/cycle'
import {
  BRISTOL_HELP, FATIGUE_LABELS, MOOD_FACES, MODE_LABELS,
  PREVENTIVE, SEVERITY_LABELS, STOOL_COLORS, SYMPTOMS, URINE_COLORS, URINE_LABELS, DRUG_WATCH, DRUG_LABELS,
  LOCATIONS,
  VITAL_SLOTS,
} from '../domain/catalogs'
import { dayNutrition, totalFluids, weekMode } from '../domain/nutrition'
import { DateNav } from '../components/DateNav'
import { Bristol, Check, Faces, Field, Section, Segmented, Severity, Stepper } from '../components/ui'

export default function Diario() {
  const params = useParams()
  const date = params.date ?? todayStr()
  const { draft, set, setExtra, logs, toastNode } = useDailyDraft(date)
  const cycles = useRows('cycles')
  const diagnoses = useRows('diagnoses')
  const patient = backend.all('patients')[0]

  const ctx = cycleContext(cycles, date)
  const defs = symptomsForToday(ctx, diagnoses)
  const mode = weekMode(draft, ctx)
  const [listMode, setListMode] = useState<'auto' | 'quimio' | 'nadir'>('auto')
  const shownMode = listMode === 'auto' ? mode : listMode
  // Lista de síntomas por semana: quimio = siempre + ciclo · nadir = siempre + fuera (+ signos de diagnósticos activos)
  const shownDefs = shownMode === mode ? defs : [...SYMPTOMS.filter((s) => s.when === 'siempre' || (shownMode === 'quimio' ? s.when === 'ciclo' : s.when === 'fuera')), ...defs.filter((d) => d.key.startsWith('dx_'))]
  const nut = dayNutrition(draft, mode)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const prev = [1, 2, 3].map((n) => byDate.get(addDays(date, -n))).filter((l): l is DailyLog => !!l)
  const traffic = dailyTraffic(draft, prev, ctx, defs)
  const hasCatheter = !!patient?.catheter_type
  const preventive = PREVENTIVE.filter((p) => !p.when || p.when === 'siempre' || (p.when === 'nadir' && ctx.nadir) || (p.when === 'cateter' && hasCatheter) || (p.when === 'mtx' && ctx.mtxDay))
  const groups = useMemo(() => Array.from(new Set(preventive.map((p) => p.group))), [preventive])
  const symptomsMarked = Object.values(draft.symptoms).filter((v) => v > 0).length
  const prevDone = preventive.filter((p) => draft.preventive[p.key]).length

  return (
    <div>
      {toastNode}
      <DateNav date={date} base="/diario" sub={ctx.cycle ? `Ciclo ${ctx.cycle.number} · D${ctx.day} · ${ctx.inCycle ? 'en ciclo' : ctx.nadir ? 'valle D7-14' : 'fuera de ciclo'}` : 'sin ciclo'} />

      <div className={'traffic ' + traffic.level} style={{ padding: '.6rem .9rem' }}>
        <strong>
          {traffic.level === 'rojo' ? 'ROJO: llamar a oncología / urgencias' : traffic.level === 'amarillo' ? 'AMARILLO: vigilar y consultar hoy' : 'Verde'}
        </strong>
        {traffic.reasons.length > 0 && <div className="small">{traffic.reasons.join(' · ')}</div>}
        {traffic.level === 'rojo' && patient?.phone_oncology && <div><a href={`tel:${patient.phone_oncology}`} style={{ color: 'inherit' }}>📞 {patient.phone_oncology}</a></div>}
      </div>

      <Section title="Dónde está y constantes" open>
        <Segmented
          options={LOCATIONS.map((l) => ({ value: l.value, label: l.label }))}
          value={draft.location}
          onChange={(v) => set('location', v ?? undefined)}
        />
        <Field label="Temperatura y tensión" hint="Mañana, tarde y noche. Con rellenar lo que se mida es suficiente.">
          <div className="table-wrap">
            <table className="table vitals">
              <thead>
                <tr><th></th><th>Temp. (°C)</th><th>Tensión (alta / baja)</th><th>Pulso</th></tr>
              </thead>
              <tbody>
                {VITAL_SLOTS.map((sl) => {
                  const v = draft.extra?.vitals?.[sl.key] ?? {}
                  const setV = (patch: Partial<typeof v>) => {
                    const vitals = { ...(draft.extra?.vitals ?? {}), [sl.key]: { ...v, ...patch } }
                    setExtra({ vitals })
                    const temps = VITAL_SLOTS.map((x) => (x.key === sl.key ? { ...v, ...patch } : vitals[x.key])?.temp).filter((t): t is number => t != null)
                    set('temp_max', temps.length ? Math.max(...temps) : null)
                  }
                  const num = (e: { target: { value: string } }) => (e.target.value === '' ? null : Number(e.target.value))
                  return (
                    <tr key={sl.key}>
                      <th scope="row">{sl.label}</th>
                      <td><input type="number" inputMode="decimal" step="0.1" min={34} max={43} value={v.temp ?? ''} onChange={(e) => setV({ temp: num(e) })} /></td>
                      <td>
                        <div className="row" style={{ gap: '.25rem', flexWrap: 'nowrap' }}>
                          <input type="number" inputMode="numeric" min={50} max={200} placeholder="alta" value={v.sys ?? ''} onChange={(e) => setV({ sys: num(e) })} />
                          <span className="muted">/</span>
                          <input type="number" inputMode="numeric" min={30} max={140} placeholder="baja" value={v.dia ?? ''} onChange={(e) => setV({ dia: num(e) })} />
                        </div>
                      </td>
                      <td><input type="number" inputMode="numeric" min={30} max={220} value={v.pulse ?? ''} onChange={(e) => setV({ pulse: num(e) })} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="muted small">Temperatura máxima del día: <strong>{draft.temp_max ?? '—'}</strong>{draft.temp_max != null && draft.temp_max >= 38 ? ' — 38 °C o más: llamar a oncología' : ''}</div>
        </Field>
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
        <Field label="Deposiciones (nº)"><Stepper value={draft.stools_n} onChange={(v) => set('stools_n', v)} /></Field>
        <Field label="Tipo de deposición (escala de Bristol)">
          <Bristol value={draft.bristol} onChange={(v) => set('bristol', v)} help={BRISTOL_HELP} />
        </Field>
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

      <Section title={`Síntomas y signos (${symptomsMarked} marcados)`} open right={<span className="tag gray">{MODE_LABELS[shownMode]}</span>}>
        <Segmented
          options={[{ value: 'quimio', label: 'Semana de quimio' }, { value: 'nadir', label: 'Semana nadir' }]}
          value={shownMode}
          onChange={(v) => setListMode(v && v !== mode ? v : 'auto')}
        />
        <p className="muted small">Marca solo lo que hay. Lo que no se toca cuenta como "No". La lista cambia sola con el ciclo; se puede ver la otra.</p>
        <Check checked={!!draft.extra?.symptoms_ok} onChange={(v) => setExtra({ symptoms_ok: v })}>Revisado: hoy no hay síntomas que marcar</Check>
        {shownDefs.map((d) => (
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

      <div className="card tight">
        <strong>Otros registros del día</strong>
        <div className="item"><div className="main"><Link to={`/nutricion/${date}`}>🥣 Comidas y peso</Link><div className="meta"><span className={'dot ' + nut.level} />{nut.meals}/{nut.target} comidas · {MODE_LABELS[mode].toLowerCase()}</div></div></div>
        <div className="item"><div className="main"><Link to={`/hidratacion/${date}`}>💧 Hidratación</Link><div className="meta">{totalFluids(draft) != null ? `${totalFluids(draft)} ml` : 'sin registrar'}</div></div></div>
        <div className="item"><div className="main"><Link to={`/biohacking/${date}`}>🌙 Sueño y luz</Link><div className="meta">{draft.sleep_start && draft.sleep_end ? `${draft.sleep_start}–${draft.sleep_end}` : 'sin registrar'}{draft.wakeups ? ` · ${draft.wakeups} despertares` : ''}</div></div></div>
        <div className="item"><div className="main"><Link to={`/ejercicio/${date}`}>🏃 Actividad y pasos</Link><div className="meta">{draft.steps ? `${draft.steps} pasos` : ''}{draft.activity_min ? ` · ${draft.activity_min} min` : ''}{!draft.steps && !draft.activity_min ? 'sin registrar' : ''}</div></div></div>
      </div>

      <Section title="Notas del día" open={!!draft.notes}>
        <textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Cualquier cosa que no esté en las listas…" />
      </Section>
    </div>
  )
}
