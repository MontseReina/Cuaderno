// Informe semanal (lunes a domingo). Todo se calcula con lo que ya está apuntado.
// Diseño y decisiones: documento «Huma · Informe semanal (diseño)», 27/09/2026.
import type { Cycle, DailyLog, Diagnosis, ExerciseSession, Intake, Meal, Patient, Product, VitalEntry, WeightEntry } from '../store/types'
import { addDays, todayStr } from './dates'
import { afterChemoGate, corticoidAlert, cycleContext, isCisplatinDay, isMtxPerfusionDay, vomitSeverity, type CycleContext } from './cycle'
import { medicationProgress, trafficWindow } from './medication'
import { dayCompleteness } from './completeness'
import { dayNutrition, fastingHours, isFatSlot, mealTraffic, totalFluids, weekMode } from './nutrition'
import { FLUID_TARGET, PREVENTIVE, SEAWATER_TARGET_ML, STOOL_COLORS, SYMPTOMS, SYNC_ITEMS, URINE_LABELS, VOMIT_KINDS, CUP_ML } from './catalogs'
import { protocolPoint } from './protocol'

// ---------- Reglas (decididas el 27/09/2026) ----------
export const RANGOS = {
  sys: [86, 110] as const, // mmHg
  diaMax: 73, // mmHg
  pulse: [75, 118] as const, // lpm, despierto y en reposo
  spo2Ok: 95, // ≥ 95 en rango; 94 vigilar; < 94 avisar
  fever: 38,
  feverLow: 37.5, // repetida el mismo día
  weightLossPct: 2, // en una semana
  desyncMin: 60, // minutos de diferencia entre la hora más temprana y la más tardía
  sleepH: [9, 12] as const,
  napMax: 90,
  minDays: 4, // menos días apuntados → «datos insuficientes»
}

export type Grade = 'Insuficiente' | 'Suficiente' | 'Bueno' | 'Excelente' | 'Datos insuficientes'
export type Light = 'verde' | 'amarillo' | 'rojo' | 'gris'
export function gradeOf(pct: number | null, dataDays = 7): Grade {
  if (pct == null || dataDays < RANGOS.minDays) return 'Datos insuficientes'
  if (pct < 60) return 'Insuficiente'
  if (pct < 80) return 'Suficiente'
  if (pct < 95) return 'Bueno'
  return 'Excelente'
}
export const GRADE_LIGHT: Record<Grade, Light> = { Insuficiente: 'rojo', Suficiente: 'amarillo', Bueno: 'verde', Excelente: 'verde', 'Datos insuficientes': 'gris' }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const dayLabel = (d: string) => `${DOW[new Date(d + 'T12:00').getDay()]} ${Number(d.slice(8))}`
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
function modeOf<T extends string>(xs: T[]): T | null {
  const c = new Map<T, number>()
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1)
  let best: T | null = null
  let n = 0
  for (const [k, v] of c) if (v > n) { best = k; n = v }
  return best
}

export interface Alerta { date: string; text: string; block: string }
export interface Indicador { label: string; value: string; light?: Light; note?: string }
export interface Parte { label: string; pct: number | null; detail: string }
export interface Bloque {
  key: string
  title: string
  ico: string
  /** Calificación de 4 niveles (bloques de cumplimiento) o semáforo (bloques clínicos). */
  grade?: Grade
  pct?: number | null
  light: Light
  summary: string
  indicators: Indicador[]
  /** Explicación según la nota: por qué / en qué mejorar / en qué insistir. */
  advice: string[]
  /** Complicaciones de salud de la semana (nutrición e hidratación, con nota baja). */
  complications?: string[]
  /** Tablas de detalle (suplementos, platos…). */
  table?: { head: string[]; rows: string[][] }
  /** Partes que forman la nota, para «mejorar / mantener». */
  parts?: Parte[]
}
export interface WeeklyData {
  logs: DailyLog[]
  cycles: Cycle[]
  products: Product[]
  intakes: Intake[]
  weights: WeightEntry[]
  sessions: ExerciseSession[]
  diagnoses: Diagnosis[]
  patient?: Patient
}
export interface WeeklyReport {
  weekStart: string
  weekEnd: string
  days: string[] // días transcurridos de la semana (hasta hoy)
  header: {
    protocolo: string | null
    ciclo: string | null
    farmacos: string | null
    casa: number
    hospital: number
    quimio: number
    nadir: number
    registro: number | null // % medio del registro diario
    diasApuntados: number
  }
  alerts: Alerta[]
  blocks: Bloque[]
  mejorar: string[]
  mantener: string[]
  corticoidNights: string[]
}

const HOSPITAL = new Set(['ingreso', 'hospital_dia', 'urgencias'])

export function buildWeekly(ws: string, data: WeeklyData, today = todayStr()): WeeklyReport {
  const all = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const days = all.filter((d) => d <= today)
  const byDate = new Map(data.logs.map((l) => [l.date, l]))
  const logOf = (d: string) => byDate.get(d)
  const logged = days.filter((d) => !!logOf(d))
  const ctxs = new Map<string, CycleContext>(days.map((d) => [d, cycleContext(data.cycles, d)]))
  const ctx = (d: string) => ctxs.get(d)!
  const modeOfDay = (d: string) => weekMode(logOf(d), ctx(d))
  const inHospital = (d: string) => HOSPITAL.has(logOf(d)?.location ?? '')
  const alerts: Alerta[] = []
  const complications = complicationsOf(days, logOf)

  // ---------- Cabecera ----------
  const pp = protocolPoint(data.patient?.protocol_start, days[days.length - 1] ?? ws)
  const lastCtx = days.length ? ctx(days[days.length - 1]) : null
  const weekCycles = data.cycles.filter((c) => { const d = (c.start_at ?? c.planned_date).slice(0, 10); return d >= ws && d <= all[6] })
  const farmacos = weekCycles.length ? Array.from(new Set(weekCycles.flatMap((c) => c.drugs))).join(' + ') : null
  const reg = days.map((d) => { const med = medicationProgress(data.products, data.intakes, data.cycles, d); const c = dayCompleteness(logOf(d), d, med); return (c.done / c.total) * 100 })
  const header = {
    protocolo: pp ? `Semana ${pp.week} de ${pp.total}${pp.plan ? ` (${pp.plan})` : ''}` : null,
    ciclo: lastCtx?.cycle ? `Ciclo ${lastCtx.cycle.number}` : null,
    farmacos,
    casa: days.filter((d) => logOf(d)?.location === 'casa').length,
    hospital: days.filter(inHospital).length,
    quimio: days.filter((d) => modeOfDay(d) === 'quimio').length,
    nadir: days.filter((d) => modeOfDay(d) === 'nadir').length,
    registro: reg.length ? Math.round(reg.reduce((a, b) => a + b, 0) / reg.length) : null,
    diasApuntados: logged.length,
  }

  const blocks: Bloque[] = [
    signos(days, logOf, data, alerts),
    preventivos(days, logOf, ctx, data),
    vomitos(days, logOf, ctx, data, alerts),
    suplementos(days, logOf, ctx, data),
    nutricion(days, logOf, ctx, modeOfDay, data, complications, alerts),
    hidratacion(days, logOf, ctx, modeOfDay, data, complications),
    ejercicio(days, logOf, ctx, inHospital, data, alerts),
    biohacking(days, logOf, data),
  ]

  // Tres cosas a mejorar y tres a mantener: las partes con porcentaje más bajo y más alto.
  const parts = blocks.flatMap((b) => (b.parts ?? []).filter((p) => p.pct != null).map((p) => ({ ...p, block: b.title })))
  const sorted = [...parts].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
  const mejorar = sorted.filter((p) => (p.pct ?? 100) < 95).slice(0, 3).map((p) => `${p.block} · ${p.label}: ${p.pct} %${p.detail ? ` (${p.detail})` : ''}`)
  const mantener = sorted.reverse().filter((p) => (p.pct ?? 0) >= 80).slice(0, 3).map((p) => `${p.block} · ${p.label}: ${p.pct} %`)

  const corticoidNights = days.filter((d) => corticoidAlert(data.cycles, d))
  return { weekStart: ws, weekEnd: all[6], days, header, alerts: alerts.sort((a, b) => a.date.localeCompare(b.date)), blocks, mejorar, mantener, corticoidNights }
}

// ---------- Complicaciones de salud (para nutrición e hidratación) ----------
function complicationsOf(days: string[], logOf: (d: string) => DailyLog | undefined): string[] {
  const list: [string, (l: DailyLog) => boolean][] = [
    ['Náuseas', (l) => (l.symptoms?.nauseas ?? 0) > 0],
    ['Vómitos', (l) => (l.extra?.vomits?.length ?? 0) > 0 || (l.symptoms?.vomitos ?? 0) > 0],
    ['Diarrea', (l) => (l.bristol ?? 0) >= 6],
    ['Estreñimiento', (l) => (l.symptoms?.estrenimiento ?? 0) > 0 || l.stools_n === 0],
    ['Llagas o dolor de boca', (l) => (l.symptoms?.mucositis ?? 0) > 0],
    ['Fiebre', (l) => (l.temp_max ?? 0) >= RANGOS.fever || (l.symptoms?.fiebre ?? 0) > 0],
    ['Dolor', (l) => (l.pain_max ?? 0) >= 4],
    ['Cansancio intenso', (l) => (l.fatigue ?? 0) >= 3],
    ['Días de hospital', (l) => HOSPITAL.has(l.location ?? '')],
  ]
  const out: string[] = []
  for (const [label, test] of list) {
    const ds = days.filter((d) => { const l = logOf(d); return !!l && test(l) })
    if (ds.length) out.push(`${label}: ${ds.map(dayLabel).join(', ')}`)
  }
  return out
}

// ---------- 1. Signos y síntomas ----------
function signos(days: string[], logOf: (d: string) => DailyLog | undefined, data: WeeklyData, alerts: Alerta[]): Bloque {
  const B = 'Signos y síntomas'
  const ind: Indicador[] = []
  const logs = days.map((d) => [d, logOf(d)] as const).filter((x): x is readonly [string, DailyLog] => !!x[1])
  let worst: Light = 'verde'
  const bump = (l: Light) => { if (l === 'rojo' || (l === 'amarillo' && worst === 'verde')) worst = l }

  // Deposiciones
  let run = 0, maxRun = 0
  for (const d of days) { const l = logOf(d); if (l?.stools_n === 0) { run++; maxRun = Math.max(maxRun, run) } else if (l?.stools_n != null) run = 0 }
  const bristols = logs.map(([, l]) => l.bristol).filter((b): b is number => b != null)
  const hard = bristols.filter((b) => b <= 2).length
  const estr = maxRun >= 2 || (bristols.length > 0 && hard > bristols.length / 2) || logs.some(([, l]) => (l.symptoms?.estrenimiento ?? 0) > 0)
  const diarreaDays = logs.filter(([, l]) => (l.bristol ?? 0) >= 6 && (l.stools_n ?? 0) >= 3).map(([d]) => d)
  const diarreaFiebre = diarreaDays.some((d) => (logOf(d)?.temp_max ?? 0) >= RANGOS.fever)
  ind.push({ label: 'Estreñimiento', value: estr ? `Sí${maxRun >= 2 ? ` · ${maxRun} días seguidos sin deposición` : ''}${bristols.length ? ` · Bristol medio ${avg(bristols)}` : ''}` : `No${bristols.length ? ` · Bristol medio ${avg(bristols)}` : ''}`, light: estr ? 'amarillo' : 'verde' })
  if (estr) bump('amarillo')
  ind.push({ label: 'Diarrea', value: diarreaDays.length ? `Sí · ${diarreaDays.map(dayLabel).join(', ')}` : 'No', light: diarreaFiebre ? 'rojo' : diarreaDays.length ? 'amarillo' : 'verde' })
  if (diarreaDays.length) bump(diarreaFiebre ? 'rojo' : 'amarillo')
  if (diarreaFiebre) alerts.push({ date: diarreaDays[0], text: 'Diarrea con fiebre', block: B })
  const colors = logs.map(([, l]) => l.stool_color).filter((c): c is NonNullable<typeof c> => !!c)
  const colorMode = modeOf(colors)
  const alarmColor = logs.filter(([, l]) => l.stool_color === 'oscuro' || l.stool_color === 'sangre' || l.stool_color === 'palido')
  for (const [d, l] of alarmColor) alerts.push({ date: d, text: `Heces: ${STOOL_COLORS.find((s) => s.key === l.stool_color)?.label.toLowerCase()}`, block: B })
  ind.push({ label: 'Color de las heces', value: colorMode ? `${STOOL_COLORS.find((s) => s.key === colorMode)?.label}${alarmColor.length ? ` · alerta: ${alarmColor.map(([d]) => dayLabel(d)).join(', ')}` : ''}` : 'Sin datos', light: alarmColor.length ? 'rojo' : colorMode ? 'verde' : 'gris' })
  if (alarmColor.length) bump('rojo')

  // Fiebre
  const temps: { d: string; t: number }[] = []
  for (const [d, l] of logs) {
    if (l.temp_max != null) temps.push({ d, t: l.temp_max })
    for (const v of Object.values(l.extra?.vitals ?? {})) if (v?.temp != null) temps.push({ d, t: v.temp })
  }
  const tmax = temps.length ? Math.max(...temps.map((x) => x.t)) : null
  const feverDays = Array.from(new Set(temps.filter((x) => x.t >= RANGOS.fever).map((x) => x.d)))
  const lowRepeated = days.filter((d) => !feverDays.includes(d) && temps.filter((x) => x.d === d && x.t >= RANGOS.feverLow).length >= 2)
  for (const d of feverDays) alerts.push({ date: d, text: `Fiebre (${Math.max(...temps.filter((x) => x.d === d).map((x) => x.t))} °C)`, block: B })
  for (const d of lowRepeated) alerts.push({ date: d, text: 'Temperatura de 37,5 °C o más repetida', block: B })
  const feverLight: Light = feverDays.length || lowRepeated.length ? 'rojo' : tmax == null ? 'gris' : 'verde'
  ind.push({ label: 'Fiebre', value: tmax == null ? 'Sin datos' : `Máxima ${tmax} °C${feverDays.length ? ` · fiebre: ${feverDays.map(dayLabel).join(', ')}` : ''}${lowRepeated.length ? ` · 37,5 °C repetida: ${lowRepeated.map(dayLabel).join(', ')}` : ''}`, light: feverLight })
  bump(feverLight === 'gris' ? 'verde' : feverLight)

  // Constantes
  const vit: { d: string; slot: string; v: VitalEntry }[] = []
  for (const [d, l] of logs) for (const [slot, v] of Object.entries(l.extra?.vitals ?? {})) if (v) vit.push({ d, slot, v })
  const slotName: Record<string, string> = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
  const constante = (label: string, has: (v: VitalEntry) => boolean, ok: (v: VitalEntry) => boolean, show: (v: VitalEntry) => string, rango: string) => {
    const xs = vit.filter((x) => has(x.v))
    if (!xs.length) { ind.push({ label, value: 'Sin datos', light: 'gris', note: rango }); return }
    const bad = xs.filter((x) => !ok(x.v))
    const p = pct(xs.length - bad.length, xs.length)!
    const light: Light = bad.length ? 'amarillo' : 'verde'
    bump(light)
    ind.push({ label, value: `${p} % en rango (${xs.length} tomas)`, light, note: bad.length ? `Fuera de rango: ${bad.slice(0, 6).map((x) => `${dayLabel(x.d)} ${slotName[x.slot] ?? x.slot} ${show(x.v)}`).join(' · ')}` : rango })
  }
  constante('Tensión arterial', (v) => v.sys != null, (v) => v.sys! >= RANGOS.sys[0] && v.sys! <= RANGOS.sys[1] && (v.dia == null || v.dia <= RANGOS.diaMax), (v) => `${v.sys}/${v.dia ?? '—'}`, 'Rango: sistólica 86–110 y diastólica hasta 73 mmHg')
  constante('Pulso', (v) => v.pulse != null, (v) => v.pulse! >= RANGOS.pulse[0] && v.pulse! <= RANGOS.pulse[1], (v) => `${v.pulse} lpm`, 'Rango: 75–118 lpm')
  const sat = vit.filter((x) => x.v.spo2 != null)
  if (sat.length) {
    const low = Math.min(...sat.map((x) => x.v.spo2!))
    const ok = sat.filter((x) => x.v.spo2! >= RANGOS.spo2Ok).length
    const light: Light = low < 94 ? 'rojo' : low < RANGOS.spo2Ok ? 'amarillo' : 'verde'
    bump(light)
    for (const x of sat.filter((x) => x.v.spo2! < 94)) alerts.push({ date: x.d, text: `Saturación ${x.v.spo2} % (${slotName[x.slot] ?? x.slot})`, block: B })
    ind.push({ label: 'Saturación de oxígeno', value: `${pct(ok, sat.length)} % en rango · la más baja ${low} %`, light, note: '95 % o más en rango; 94 % vigilar; menos de 94 % avisar' })
  } else ind.push({ label: 'Saturación de oxígeno', value: 'Sin datos', light: 'gris' })

  // Fatiga, ánimo y dolor (con la semana anterior)
  const prevDays = days.map((d) => addDays(d, -7))
  const series = (f: (l: DailyLog) => number | null | undefined, ds: string[]) => ds.map((d) => logOf(d)).filter((l): l is DailyLog => !!l).map(f).filter((x): x is number => x != null)
  const trend = (a: number | null, b: number | null, higherIsBetter: boolean) => (a == null || b == null ? '' : a === b ? ' =' : (a > b) === higherIsBetter ? ' ↑ mejor que la semana anterior' : ' ↓ peor que la semana anterior')
  const fat = avg(series((l) => l.fatigue, days)), fatP = avg(series((l) => l.fatigue, prevDays))
  ind.push({ label: 'Fatiga (0–4)', value: fat == null ? 'Sin datos' : `${fat}${trend(fat, fatP, false)}`, light: fat == null ? 'gris' : fat >= 3 ? 'amarillo' : 'verde' })
  const mood = avg(series((l) => l.mood_child, days)), moodP = avg(series((l) => l.mood_child, prevDays))
  ind.push({ label: 'Ánimo (1–5)', value: mood == null ? 'Sin datos' : `${mood}${trend(mood, moodP, true)}`, light: mood == null ? 'gris' : mood <= 2 ? 'amarillo' : 'verde' })
  const pains = series((l) => l.pain_max, days)
  const pain = avg(pains), painP = avg(series((l) => l.pain_max, prevDays))
  const painMax = pains.length ? Math.max(...pains) : null
  const where = Array.from(new Set(logs.map(([, l]) => l.pain_location).filter(Boolean)))
  ind.push({ label: 'Dolor (0–10)', value: pain == null ? 'Sin datos' : `Media ${pain} · máximo ${painMax}${where.length ? ` · ${where.join(', ')}` : ''}${trend(pain, painP, false)}`, light: painMax == null ? 'gris' : painMax >= 7 ? 'rojo' : painMax >= 4 ? 'amarillo' : 'verde' })
  if (painMax != null && painMax >= 7) { bump('rojo'); alerts.push({ date: logs.find(([, l]) => l.pain_max === painMax)![0], text: `Dolor intenso (${painMax}/10)`, block: B }) }

  // Síntomas destacables
  const keys = new Set<string>()
  for (const [, l] of logs) for (const k of Object.keys(l.symptoms ?? {})) keys.add(k)
  const notable: string[] = []
  for (const k of keys) {
    const vals = logs.map(([d, l]) => ({ d, v: l.symptoms?.[k] ?? 0 })).filter((x) => x.v > 0)
    if (!vals.length) continue
    const def = SYMPTOMS.find((s) => s.key === k)
    const max = Math.max(...vals.map((x) => x.v))
    if (!(max >= 2 || vals.length >= 3 || (def?.redAt3 && max >= 3) || k.startsWith('dx_'))) continue
    const prev = prevDays.map((d) => logOf(d)?.symptoms?.[k] ?? 0).filter((v) => v > 0).length
    const dir = prev ? (vals.length > prev ? ' · va a más' : vals.length < prev ? ' · va a menos' : '') : ''
    const label = def?.label ?? k.replace(/^dx_/, '').replace(/_/g, ' ')
    notable.push(`${label}: ${vals.length} día${vals.length > 1 ? 's' : ''}, máximo ${['', 'leve', 'moderado', 'intenso'][max]}${dir}`)
    if (def?.redAt3 && max >= 3) { bump('rojo'); alerts.push({ date: vals.find((x) => x.v === 3)!.d, text: `${label}: intenso`, block: B }) }
    else bump('amarillo')
  }
  const phlegm = logs.filter(([, l]) => l.extra?.phlegm_color === 'verde' || l.extra?.phlegm_color === 'rojo')
  for (const [d, l] of phlegm) { notable.push(`Flemas ${l.extra!.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'} (${dayLabel(d)})`); alerts.push({ date: d, text: `Flemas ${l.extra!.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'}`, block: B }); bump('rojo') }
  const watch = data.diagnoses.filter((d) => d.status === 'activo').flatMap((d) => d.watch_signs.map((s) => `${s} (${d.name})`))

  const light: Light = logs.length ? worst : 'gris'
  return {
    key: 'signos', title: B, ico: '📝', light,
    summary: light === 'gris' ? 'Sin registros' : light === 'verde' ? 'Todo en rango' : light === 'amarillo' ? 'Hay cosas a vigilar' : 'Hay alertas: ver arriba',
    indicators: ind,
    advice: [
      ...(notable.length ? ['Síntomas destacables a vigilar:', ...notable.map((n) => '· ' + n)] : ['Sin síntomas destacables esta semana.']),
      ...(watch.length ? ['Signos a vigilar de los diagnósticos activos:', ...watch.map((w) => '· ' + w)] : []),
    ],
  }
}

// ---------- 2. Cuidados preventivos ----------
function preventivos(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData): Bloque {
  const hasCatheter = !!data.patient?.catheter_type?.trim()
  const groups = new Map<string, { hechos: number; previstos: number; items: Map<string, { label: string; hechos: number; previstos: number }> }>()
  for (const d of days) {
    const c = ctx(d)
    const l = logOf(d)
    const aplica = PREVENTIVE.filter((p) => !p.when || p.when === 'siempre' || (p.when === 'nadir' && c.nadir) || (p.when === 'cateter' && hasCatheter) || (p.when === 'mtx' && isMtxPerfusionDay(data.cycles, d)) || (p.when === 'infusion' && trafficWindow(c, d) === 'infusion'))
    for (const p of aplica) {
      const mark = l?.preventive?.[p.key]
      if (mark === 'np') continue
      const g = groups.get(p.group) ?? { hechos: 0, previstos: 0, items: new Map() }
      const it = g.items.get(p.key) ?? { label: p.label, hechos: 0, previstos: 0 }
      g.previstos++; it.previstos++
      if (mark === true) { g.hechos++; it.hechos++ }
      g.items.set(p.key, it)
      groups.set(p.group, g)
    }
  }
  const parts: Parte[] = []
  const ind: Indicador[] = []
  let H = 0, P = 0
  for (const [name, g] of groups) {
    H += g.hechos; P += g.previstos
    const p = pct(g.hechos, g.previstos)
    const worstItem = [...g.items.values()].sort((a, b) => a.hechos / a.previstos - b.hechos / b.previstos)[0]
    const det = worstItem && worstItem.hechos < worstItem.previstos ? `${worstItem.label.toLowerCase()}: ${worstItem.hechos} de ${worstItem.previstos}` : ''
    parts.push({ label: name, pct: p, detail: det })
    ind.push({ label: name, value: `${p} %`, light: GRADE_LIGHT[gradeOf(p)], note: det ? `Lo que más falta: ${det}` : undefined })
  }
  const total = pct(H, P)
  const grade = gradeOf(total, days.filter((d) => !!logOf(d)).length)
  const worst = [...parts].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0]
  const advice: string[] = []
  if (worst && (worst.pct ?? 100) < 95) advice.push(`A mejorar: ${worst.label} (${worst.pct} %)${worst.detail ? `. Lo que más se ha quedado sin hacer: ${worst.detail}.` : '.'}`)
  // Cruce con síntomas
  const boca = days.some((d) => (logOf(d)?.symptoms?.mucositis ?? 0) > 0)
  const piel = days.some((d) => (logOf(d)?.symptoms?.piel ?? 0) > 0)
  const pBoca = parts.find((p) => p.label === 'Boca')?.pct ?? 100
  const pPiel = parts.find((p) => p.label === 'Piel y pelo')?.pct ?? 100
  if (boca && pBoca < 80) advice.push(`⚠️ Esta semana hubo llagas o dolor de boca y los cuidados de boca están al ${pBoca} %.`)
  if (piel && pPiel < 80) advice.push(`⚠️ Esta semana hubo problemas de piel y los cuidados de piel y pelo están al ${pPiel} %.`)
  if (!advice.length && total != null) advice.push('Seguir igual: los cuidados se están haciendo casi todos los días.')
  return { key: 'preventivos', title: 'Cuidados preventivos', ico: '🧴', grade, pct: total, light: GRADE_LIGHT[grade], summary: total == null ? 'Sin datos' : `${total} % cumplido`, indicators: ind, advice, parts }
}

// ---------- 3. Vómitos ----------
function vomitos(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData, alerts: Alerta[]): Bloque {
  const B = 'Vómitos'
  const eps = days.flatMap((d) => (logOf(d)?.extra?.vomits ?? []).map((e) => ({ d, ...e })))
  const vdays = days.filter((d) => (logOf(d)?.extra?.vomits?.length ?? 0) > 0 || logOf(d)?.extra?.vomit_no_liquids)
  const sev = days.map((d) => ({ d, s: vomitSeverity(logOf(d)?.extra) }))
  const worst = [...sev].sort((a, b) => b.s - a.s)[0]
  const kinds = new Map<string, number>()
  for (const e of eps) if (e.kind) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1)
  const franja = (t: string) => { const h = Number(t.slice(0, 2)); return h >= 6 && h < 14 ? 'mañana' : h >= 14 && h < 21 ? 'tarde' : 'noche' }
  const fr = modeOf(eps.filter((e) => e.time).map((e) => franja(e.time)))
  const afterChemo = Array.from(new Set(vdays.map((d) => ctx(d).day).filter((x): x is number => x != null && x >= 0))).sort((a, b) => a - b)
  const noLiq = days.filter((d) => logOf(d)?.extra?.vomit_no_liquids)
  const nau = days.map((d) => logOf(d)?.symptoms?.nauseas ?? 0)
  const nauDays = nau.filter((v) => v > 0).length
  const lost = data.intakes.filter((i) => days.includes(i.date) && i.status === 'no_dada' && /v[oó]mito/i.test(i.reason ?? '')).length
  const rescue = data.products.filter((p) => /nux|ondansetr/i.test(p.name))
  const rescueN = rescue.map((p) => ({ p, n: data.intakes.filter((i) => i.product_id === p.id && days.includes(i.date) && (i.status === 'dada' || i.taken)).length })).filter((x) => x.n > 0)
  const red = eps.some((e) => VOMIT_KINDS.find((k) => k.value === e.kind)?.alerta) || noLiq.length > 0
  for (const e of eps.filter((e) => VOMIT_KINDS.find((k) => k.value === e.kind)?.alerta)) alerts.push({ date: e.d, text: `Vómito ${VOMIT_KINDS.find((k) => k.value === e.kind)?.label.toLowerCase()}`, block: B })
  for (const d of noLiq) alerts.push({ date: d, text: 'No retiene ni líquidos', block: B })
  const light: Light = red ? 'rojo' : sev.some((x) => x.s >= 2) || vdays.length >= 3 ? 'amarillo' : 'verde'
  const ind: Indicador[] = [
    { label: 'Episodios', value: eps.length ? `${eps.length} en ${vdays.length} día${vdays.length > 1 ? 's' : ''}` : 'Ninguno', light },
    ...(worst && worst.s > 0 ? [{ label: 'Peor día', value: `${dayLabel(worst.d)} · ${logOf(worst.d)?.extra?.vomits?.length ?? 0} episodios · ${['', 'leve', 'moderado', 'intenso'][worst.s]}` }] : []),
    ...(kinds.size ? [{ label: 'Tipos', value: [...kinds].map(([k, n]) => `${VOMIT_KINDS.find((x) => x.value === k)?.label.toLowerCase() ?? k} ${n}`).join(' · ') }] : []),
    ...(fr ? [{ label: 'Franja con más vómitos', value: fr }] : []),
    ...(afterChemo.length ? [{ label: 'Días tras la quimio', value: afterChemo.map((x) => `D${x}`).join(', ') }] : []),
    ...(noLiq.length ? [{ label: 'No retiene líquidos', value: noLiq.map(dayLabel).join(', '), light: 'rojo' as Light }] : []),
    { label: 'Náuseas', value: nauDays ? `${nauDays} día${nauDays > 1 ? 's' : ''} · máximo ${['', 'leve', 'moderada', 'intensa'][Math.max(...nau)]}` : 'Ninguna' },
    ...(lost ? [{ label: 'Tomas perdidas por vómito', value: String(lost) }] : []),
    ...(rescueN.length ? [{ label: 'Rescate usado', value: rescueN.map((x) => `${x.p.name}: ${x.n}`).join(' · ') }] : []),
  ]
  return {
    key: 'vomitos', title: B, ico: '🤢', light,
    summary: eps.length ? `${eps.length} episodios` : 'Sin vómitos',
    indicators: ind,
    advice: eps.length ? ['La hora y los días tras la quimio sirven para comentar con oncología si el antiemético cubre bien esa franja.'] : [],
  }
}

// ---------- 4. Suplementación (y medicación del hospital aparte) ----------
function suplementos(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData): Bloque {
  const MOM: Record<string, string> = { ayunas: 'ayunas', manana: 'mañana', media_manana: 'media mañana', comida: 'comida', media_tarde: 'media tarde', cena: 'cena', dormir: 'antes de dormir' }
  const per = new Map<string, { name: string; previstas: number; dadas: number; noDadas: number; reasons: string[]; misses: string[] }>()
  const reasons: string[] = []
  const missMoments: string[] = []
  const missPhase = { quimio: [0, 0], nadir: [0, 0], hospital: [0, 0] } as Record<string, [number, number]>
  const missSymptomDays = new Set<string>()
  const hospitalMisses: string[] = []
  for (const d of days) {
    const c = ctx(d)
    const wk = trafficWindow(c, d)
    const dow = new Date(d + 'T12:00').getDay()
    const l = logOf(d)
    const phase = HOSPITAL.has(l?.location ?? '') ? 'hospital' : weekMode(l, c)
    for (const p of data.products) {
      if (p.end_date && p.end_date <= d) continue
      if (p.start_date && p.start_date > d) continue
      if (!p.moments?.length || p.condition) continue
      if (p.weekdays?.length && !p.weekdays.includes(dow)) continue
      if (afterChemoGate(p, data.cycles, d)?.waiting) continue
      if (wk && p.traffic?.[wk] === 'rojo') continue
      for (const m of p.moments) {
        const it = data.intakes.find((i) => i.product_id === p.id && i.date === d && i.moment === m)
        if (it?.status === 'no_precisa') continue
        const given = !!(it?.taken || it?.status === 'dada')
        if (p.block === 'hospital') { if (!given) hospitalMisses.push(`${p.name} · ${dayLabel(d)} ${MOM[m] ?? m}${it?.status === 'no_dada' ? ` · ${it.reason ?? 'no dada'}` : ' · sin marcar'}`); continue }
        if (p.block !== 'sup_ciclo' && p.block !== 'sup_fuera') continue
        const s = per.get(p.id) ?? { name: p.name, previstas: 0, dadas: 0, noDadas: 0, reasons: [], misses: [] }
        s.previstas++
        missPhase[phase][1]++
        if (given) s.dadas++
        else {
          const r = it?.status === 'no_dada' ? (it.reason || 'Otro') : 'Sin marcar'
          if (it?.status === 'no_dada') s.noDadas++
          s.reasons.push(r); s.misses.push(MOM[m] ?? m)
          reasons.push(r); missMoments.push(MOM[m] ?? m)
          missPhase[phase][0]++
          const sy = l?.symptoms ?? {}
          if ((sy.nauseas ?? 0) > 0 || (sy.mucositis ?? 0) > 0 || (l?.extra?.vomits?.length ?? 0) > 0) missSymptomDays.add(d)
        }
        per.set(p.id, s)
      }
    }
  }
  const rows = [...per.values()].sort((a, b) => a.dadas / a.previstas - b.dadas / b.previstas)
  const P = rows.reduce((a, r) => a + r.previstas, 0)
  const D = rows.reduce((a, r) => a + r.dadas, 0)
  const total = pct(D, P)
  const grade = gradeOf(total, days.filter((d) => !!logOf(d)).length)
  const dificil = rows.filter((r) => r.dadas / r.previstas < 0.8 || r.reasons.filter((x) => /no quiso|molestias/i.test(x)).length >= 2)
  const advice: string[] = []
  const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  if (grade === 'Insuficiente' || grade === 'Suficiente') {
    advice.push('Qué lo está afectando:')
    const rc = count(reasons)
    if (rc.length) advice.push('· Motivos: ' + rc.map(([k, n]) => `${k.toLowerCase()} ${n}`).join(', '))
    const mc = count(missMoments)
    if (mc.length) advice.push(`· Momento del día con más tomas perdidas: ${mc[0][0]} (${mc[0][1]})`)
    const ph = Object.entries(missPhase).filter(([, [, t]]) => t > 0).map(([k, [m, t]]) => `${k} ${Math.round((m / t) * 100)} % sin dar`)
    if (ph.length) advice.push('· Por fase: ' + ph.join(', '))
    if (missSymptomDays.size) advice.push(`· Días con náuseas, vómitos o llagas en los que se perdieron tomas: ${[...missSymptomDays].map(dayLabel).join(', ')}`)
    if (dificil.length) advice.push('Suplementos con dificultad: ' + dificil.map((r) => `${r.name} (${pct(r.dadas, r.previstas)} %)`).join(', '))
    if (reasons.some((r) => /no quiso/i.test(r))) advice.push('En qué mejorar: si el motivo es «no quiso tomarla», preguntar a la doctora si hay otro formato (le cuesta tragar suplementos).')
    if (reasons.some((r) => /molestias/i.test(r))) advice.push('En qué mejorar: si hay molestias gástricas, preguntar si se puede cambiar el momento o tomarlo con comida.')
    if (reasons.some((r) => /sin marcar/i.test(r))) advice.push('Hay tomas sin marcar: puede que se dieran y no se apuntaran.')
  } else if (grade === 'Bueno' || grade === 'Excelente') {
    const low = rows[0]
    if (low && low.dadas < low.previstas) advice.push(`Seguir insistiendo en ${low.name} (${pct(low.dadas, low.previstas)} %).`)
    const mc = count(missMoments)
    if (mc.length) advice.push(`El momento que más cuesta es ${mc[0][0]}.`)
    else advice.push('Todas las tomas previstas se han dado.')
  }
  if (hospitalMisses.length) advice.push('Medicación del hospital no dada:', ...hospitalMisses.map((h) => '· ' + h))
  return {
    key: 'suplementos', title: 'Suplementación', ico: '💊', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin tomas previstas' : `${D} de ${P} tomas dadas (${total} %)`,
    indicators: hospitalMisses.length ? [{ label: 'Medicación del hospital', value: `${hospitalMisses.length} toma${hospitalMisses.length > 1 ? 's' : ''} no dada${hospitalMisses.length > 1 ? 's' : ''}`, light: 'rojo' }] : [{ label: 'Medicación del hospital', value: 'Todas dadas o sin tomas previstas', light: 'verde' }],
    advice,
    table: rows.length ? { head: ['Suplemento', 'Previstas', 'Dadas', 'No dadas · motivo', 'Momento que falla'], rows: rows.map((r) => [r.name, String(r.previstas), `${r.dadas} (${pct(r.dadas, r.previstas)} %)`, r.reasons.length ? `${r.reasons.length} · ${modeOf(r.reasons)?.toLowerCase()}` : '—', modeOf(r.misses) ?? '—']) } : undefined,
    parts: rows.length ? [{ label: 'Tomas de suplementos', pct: total, detail: dificil.length ? `cuesta: ${dificil.slice(0, 3).map((r) => r.name).join(', ')}${dificil.length > 3 ? '…' : ''}` : '' }] : [],
  }
}

// ---------- 5. Nutrición ----------
function nutricion(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, modeOfDay: (d: string) => 'quimio' | 'nadir', data: WeeklyData, complications: string[], alerts: Alerta[]): Bloque {
  const ind: Indicador[] = []
  const parts: Parte[] = []
  const logged = days.filter((d) => !!logOf(d))
  // Ayuno
  const fasts = days.map((d) => ({ d, h: fastingHours(logOf(d), logOf(addDays(d, -1))), mtx: ctx(d).mtxDay })).filter((x) => x.h != null) as { d: string; h: number; mtx: boolean }[]
  const normal = fasts.filter((x) => !x.mtx).map((x) => x.h)
  const mtx = fasts.filter((x) => x.mtx)
  ind.push({ label: 'Horas de ayuno (noche)', value: normal.length ? `Media ${avg(normal)} h · mín. ${Math.min(...normal)} · máx. ${Math.max(...normal)}` : 'Sin datos', note: mtx.length ? `Días de metotrexato (ayuno marcado por la quimio): ${mtx.map((x) => `${dayLabel(x.d)} ${x.h} h`).join(', ')}` : undefined })
  // Desincronización
  for (const slot of ['desayuno', 'comida', 'cena'] as const) {
    const ts = days.map((d) => logOf(d)?.meals.find((m) => m.slot === slot)?.time).filter((t): t is string => !!t).map(mins)
    if (ts.length < 2) { ind.push({ label: `Desincronización · ${slot}`, value: 'Pocos datos', light: 'gris' }); continue }
    const range = Math.max(...ts) - Math.min(...ts)
    const distinct = new Set(ts).size
    const ok = range >= RANGOS.desyncMin
    ind.push({ label: `Desincronización · ${slot}`, value: `${ok ? 'Sí varía' : 'No varía lo suficiente'} · de ${fmtMin(Math.min(...ts))} a ${fmtMin(Math.max(...ts))} (${range} min, ${distinct} horas distintas)`, light: ok ? 'verde' : 'amarillo' })
    parts.push({ label: `Horario variable ${slot === 'desayuno' ? 'del desayuno' : slot === 'comida' ? 'de la comida' : 'de la cena'}`, pct: ok ? 100 : Math.min(99, Math.round((range / RANGOS.desyncMin) * 100)), detail: ok ? '' : `varía ${range} min` })
  }
  // Número de comidas según la fase del día
  const qd = logged.filter((d) => modeOfDay(d) === 'quimio')
  const nd = logged.filter((d) => modeOfDay(d) === 'nadir')
  const eaten = (d: string) => dayNutrition(logOf(d), modeOfDay(d), { cisplatin: isCisplatinDay(ctx(d)) }).meals
  const qOk = qd.filter((d) => eaten(d) >= 3).length
  const nOk = nd.filter((d) => eaten(d) >= 5).length
  if (qd.length) ind.push({ label: 'Días de quimio con 3–4 comidas', value: `${qOk} de ${qd.length}`, light: qOk === qd.length ? 'verde' : 'amarillo' })
  if (nd.length) ind.push({ label: 'Días de nadir con 5–6 comidas', value: `${nOk} de ${nd.length}`, light: nOk === nd.length ? 'verde' : 'amarillo' })
  parts.push({ label: 'Días con las comidas de su fase', pct: pct(qOk + nOk, qd.length + nd.length), detail: '' })
  const protOk = logged.filter((d) => (logOf(d)?.meals ?? []).filter((m) => (m.macros?.prot ?? 0) >= 1 && (m.fraction ?? 1) > 0).length >= 3).length
  ind.push({ label: 'Proteína en 3 ingestas', value: `${protOk} de ${logged.length} días` })
  parts.push({ label: 'Proteína en 3 ingestas', pct: pct(protOk, logged.length), detail: '' })
  // Peso y talla
  const ws = [...data.weights].filter((w) => w.at.slice(0, 10) >= days[0] && w.at.slice(0, 10) <= days[days.length - 1]).sort((a, b) => a.at.localeCompare(b.at))
  const before = [...data.weights].filter((w) => w.at.slice(0, 10) < days[0]).sort((a, b) => b.at.localeCompare(a.at))[0]
  let lossPct: number | null = null
  const ref = ws.length >= 2 ? ws[0] : before
  const last = ws[ws.length - 1]
  if (ref && last && ref !== last) {
    const diff = Math.round((last.kg - ref.kg) * 10) / 10
    lossPct = Math.round(((ref.kg - last.kg) / ref.kg) * 1000) / 10
    const light: Light = lossPct >= RANGOS.weightLossPct ? 'rojo' : diff < 0 ? 'amarillo' : 'verde'
    if (light === 'rojo') alerts.push({ date: last.at.slice(0, 10), text: `Pérdida de peso del ${lossPct} % en la semana`, block: 'Nutrición' })
    ind.push({ label: 'Peso', value: `${ref.kg} → ${last.kg} kg (${diff > 0 ? '+' : ''}${diff} kg, ${lossPct > 0 ? '−' : '+'}${Math.abs(lossPct)} %)`, light })
  } else ind.push({ label: 'Peso', value: last ? `${last.kg} kg (una sola pesada)` : 'Sin pesadas esta semana', light: 'gris' })
  const hNow = [...data.weights].filter((w) => w.height_cm && w.at.slice(0, 10) <= days[days.length - 1]).sort((a, b) => b.at.localeCompare(a.at))
  if (hNow.length >= 2 && hNow[0].at.slice(0, 10) >= days[0]) ind.push({ label: 'Talla', value: `${hNow[0].height_cm} cm (${Math.round((hNow[0].height_cm! - hNow[1].height_cm!) * 10) / 10} cm desde la medida anterior)` })
  else if (hNow.length) ind.push({ label: 'Talla', value: `${hNow[0].height_cm} cm (sin medida nueva esta semana)` })
  const ib = ws.filter((w) => w.muscle_kg != null)
  const ibPrev = [...data.weights].filter((w) => w.muscle_kg != null && (!ib.length || w.at < ib[ib.length - 1].at)).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (ib.length) ind.push({ label: 'InBody', value: `Músculo ${ib[ib.length - 1].muscle_kg} kg${ibPrev ? ` (antes ${ibPrev.muscle_kg} kg)` : ''}${ib[ib.length - 1].fat_pct != null ? ` · grasa ${ib[ib.length - 1].fat_pct} %` : ''}` })
  // Plato (comida y cena)
  const plates: { d: string; m: Meal; missing: string[] }[] = []
  for (const d of logged) for (const m of logOf(d)!.meals.filter((x) => (x.slot === 'comida' || x.slot === 'cena') && x.macros && (x.fraction ?? 1) > 0)) {
    const t = mealTraffic(m, { cisplatin: isCisplatinDay(ctx(d)) })
    plates.push({ d, m, missing: (t?.missing ?? []).filter((x) => !x.includes('mitad')) })
  }
  const okPlates = plates.filter((p) => !p.missing.length).length
  const faltas = new Map<string, number>()
  for (const p of plates) for (const f of p.missing) faltas.set(f, (faltas.get(f) ?? 0) + 1)
  const topFaltas = [...faltas].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`).join(', ')
  ind.push({ label: 'Plato Harvard (comida y cena)', value: plates.length ? `${okPlates} de ${plates.length} platos cumplen` : 'Sin platos valorados', light: plates.length ? GRADE_LIGHT[gradeOf(pct(okPlates, plates.length))] : 'gris', note: topFaltas ? `Lo que más falta: ${topFaltas}` : undefined })
  parts.push({ label: 'Plato Harvard', pct: pct(okPlates, plates.length), detail: topFaltas })
  const starchDays = logged.filter((d) => logOf(d)!.meals.some((m) => (m.slot === 'comida' || m.slot === 'cena') && (m.macros?.starch ?? 0) > 0))
  const resDays = starchDays.filter((d) => logOf(d)!.meals.some((m) => (m.slot === 'comida' || m.slot === 'cena') && (m.macros?.starch ?? 0) > 0 && m.macros?.resistant))
  ind.push({ label: 'Almidón resistente', value: starchDays.length ? `${resDays.length} de ${starchDays.length} días con almidón` : 'Sin almidón apuntado' })
  parts.push({ label: 'Almidón resistente', pct: pct(resDays.length, starchDays.length), detail: '' })
  const nadirLogged = nd
  const snacksPrev = nadirLogged.length * 2
  const snacksOk = nadirLogged.reduce((a, d) => a + logOf(d)!.meals.filter((m) => isFatSlot(m.slot) && m.macros?.fat === true && (m.fraction ?? 1) > 0).length, 0)
  if (snacksPrev) { ind.push({ label: 'Snacks de pura grasa (nadir)', value: `${snacksOk} de ${snacksPrev}` }); parts.push({ label: 'Snacks de pura grasa', pct: pct(snacksOk, snacksPrev), detail: '' }) }
  // Nota
  const vals = parts.filter((p) => p.pct != null && !p.label.startsWith('Horario')).map((p) => p.pct!)
  let total = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  let grade = gradeOf(total, logged.length)
  if (lossPct != null && lossPct >= RANGOS.weightLossPct && (grade === 'Bueno' || grade === 'Excelente')) { grade = 'Suficiente'; total = Math.min(total ?? 79, 79) }
  const advice: string[] = []
  const scored = parts.filter((p) => p.pct != null && !p.label.startsWith('Horario')).sort((a, b) => a.pct! - b.pct!)
  if (grade === 'Insuficiente' || grade === 'Suficiente') {
    advice.push('Por qué: ' + scored.slice(0, 2).map((p) => `${p.label.toLowerCase()} ${p.pct} %${p.detail ? ` (${p.detail})` : ''}`).join('; ') + '.')
    const poco = logged.filter((d) => logOf(d)!.meals.some((m) => m.fraction != null && m.fraction < 0.5)).length
    if (poco) advice.push(`Comió menos de la mitad en alguna comida ${poco} día${poco > 1 ? 's' : ''}.`)
    if (lossPct != null && lossPct >= RANGOS.weightLossPct) advice.push(`El peso ha bajado un ${lossPct} %: la nota no puede pasar de «Suficiente».`)
    advice.push(`En qué mejorar: ${scored[0]?.label.toLowerCase() ?? '—'}.`)
  } else if (grade === 'Bueno') advice.push(`Seguir haciendo hincapié en: ${scored[0]?.label.toLowerCase() ?? '—'} (${scored[0]?.pct} %).`)
  else if (grade === 'Excelente') advice.push('Mantener: se está cumpliendo la pauta de la nutricionista.')
  return {
    key: 'nutricion', title: 'Nutrición', ico: '🥣', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin datos' : `${total} %`, indicators: ind, advice, parts,
    complications: grade === 'Insuficiente' || grade === 'Suficiente' ? complications : undefined,
  }
}

// ---------- 6. Hidratación ----------
function hidratacion(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, modeOfDay: (d: string) => 'quimio' | 'nadir', data: WeeklyData, complications: string[]): Bloque {
  const withF = days.filter((d) => totalFluids(logOf(d)) != null)
  const reach = withF.filter((d) => totalFluids(logOf(d))! >= FLUID_TARGET[modeOfDay(d)])
  const total = pct(reach.length, withF.length)
  const grade = gradeOf(total, withF.length)
  const ml = withF.map((d) => totalFluids(logOf(d))!)
  const logged = days.filter((d) => !!logOf(d))
  const drink = (label: string, f: (l: DailyLog) => number) => {
    const v = logged.map((d) => f(logOf(d)!))
    const pv = days.map((d) => logOf(addDays(d, -7))).filter((l): l is DailyLog => !!l).map(f)
    const a = avg(v) ?? 0
    const pa = avg(pv)
    return { label, avg: a, zero: v.filter((x) => !x).length, ratio: pa ? a / pa : 1 }
  }
  const drinks = [drink('Agua', (l) => l.water_ml ?? 0), drink('Agua de mar', (l) => l.seawater_ml ?? 0), drink('Caldo', (l) => (l.broth_cups ?? 0) * CUP_ML)]
  const inf = avg(logged.map((d) => logOf(d)!.extra?.infusion_cups ?? 0))
  // La que más cuesta: más días sin tomar; a igualdad, la que más ha bajado frente a la semana anterior.
  const hardest = [...drinks].sort((a, b) => b.zero - a.zero || a.ratio - b.ratio)[0]
  const clearHardest = hardest.zero > 0 || hardest.ratio < 0.9
  const hardText = clearHardest
    ? `La bebida que más le cuesta: ${hardest.label.toLowerCase()} (${hardest.zero} días sin tomar, ${Math.round(hardest.avg)} ml/día de media${hardest.ratio < 0.9 ? `, ${Math.round((1 - hardest.ratio) * 100)} % menos que la semana anterior` : ''}).`
    : 'Agua, agua de mar y caldo se toman todos los días: lo que falta es cantidad total.'
  const colors = logged.map((d) => logOf(d)!.urine_color).filter((c): c is number => c != null)
  const cAvg = avg(colors)
  const cMax = colors.length ? Math.max(...colors) : null
  const voids = logged.map((d) => logOf(d)!.urine_count).filter((c): c is number => c != null)
  const usual = data.patient?.usual_voids ?? null
  const menos = logged.filter((d) => logOf(d)!.urine_amount === 'menos')
  const vAvg = avg(voids)
  const fewer = menos.length >= 2 || (usual != null && vAvg != null && vAvg < usual)
  const mtxDays = days.filter((d) => ctx(d).mtxDay && logOf(d)?.urine_ph != null)
  const phOk = mtxDays.filter((d) => logOf(d)!.urine_ph! >= 7).length
  const ind: Indicador[] = [
    { label: 'Líquidos totales', value: ml.length ? `Media ${Math.round(ml.reduce((a, b) => a + b, 0) / ml.length)} ml/día · llega al objetivo ${reach.length} de ${withF.length} días` : 'Sin datos', light: GRADE_LIGHT[grade], note: 'Objetivo: 1.500 ml en quimio y 1.200 ml en nadir (pendiente de la nutricionista)' },
    { label: 'Agua', value: `${Math.round(drinks[0].avg)} ml/día · ${drinks[0].zero} días sin tomar` },
    { label: 'Agua de mar', value: `${Math.round(drinks[1].avg)} ml/día (objetivo ${SEAWATER_TARGET_ML}) · ${drinks[1].zero} días sin tomar`, light: drinks[1].avg >= SEAWATER_TARGET_ML ? 'verde' : 'amarillo' },
    { label: 'Caldo', value: `${Math.round(drinks[2].avg)} ml/día · ${drinks[2].zero} días sin tomar` },
    { label: 'Manzanilla y jengibre', value: inf ? `${inf} medias tazas/día` : 'Nada apuntado' },
    { label: 'Color de la orina', value: cAvg == null ? 'Sin datos' : `Media ${cAvg} (${URINE_LABELS[Math.round(cAvg) - 1]?.toLowerCase()}) · peor ${cMax}`, light: cMax == null ? 'gris' : cMax >= 5 ? 'rojo' : cMax >= 4 ? 'amarillo' : 'verde' },
    { label: 'Micciones', value: `${vAvg != null ? `Media ${vAvg}/día` : 'Sin número apuntado'}${usual != null ? ` (lo habitual: ${usual})` : ''}${menos.length ? ` · «menos de lo habitual»: ${menos.map(dayLabel).join(', ')}` : ''}`, light: fewer ? 'amarillo' : 'verde', note: usual == null ? 'Pon lo habitual en Pilares → Ajustes' : undefined },
    ...(mtxDays.length ? [{ label: 'pH de orina en metotrexato', value: `${pct(phOk, mtxDays.length)} % con pH 7 o más`, light: (phOk === mtxDays.length ? 'verde' : 'rojo') as Light }] : []),
  ]
  const hosp = days.filter((d) => HOSPITAL.has(logOf(d)?.location ?? ''))
  const advice: string[] = []
  if (grade === 'Insuficiente' || grade === 'Suficiente') {
    advice.push(hardText)
    if (hosp.length) advice.push(`Días de hospital (los sueros no se cuentan): ${hosp.map(dayLabel).join(', ')}.`)
    advice.push(clearHardest ? `En qué mejorar: ofrecer ${hardest.label.toLowerCase()} a sorbos a lo largo del día.` : 'En qué mejorar: subir la cantidad total, a sorbos a lo largo del día.')
  } else if (grade === 'Bueno' || grade === 'Excelente') advice.push(clearHardest ? `Seguir insistiendo en: ${hardest.label.toLowerCase()}, que es la que más le cuesta.` : 'Mantener: toma las tres bebidas todos los días.')
  if (fewer) advice.push('Orina menos de lo habitual: vigilar la hidratación.')
  return {
    key: 'hidratacion', title: 'Hidratación', ico: '💧', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin datos' : `${reach.length} de ${withF.length} días en el objetivo`, indicators: ind, advice,
    complications: grade === 'Insuficiente' || grade === 'Suficiente' ? complications.filter((c) => !/^Dolor|^Estreñimiento/.test(c)) : undefined,
    parts: [{ label: 'Días con los líquidos del objetivo', pct: total, detail: clearHardest ? `cuesta ${hardest.label.toLowerCase()}` : '' }],
  }
}

// ---------- 7. Ejercicio ----------
function ejercicio(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, inHospital: (d: string) => boolean, data: WeeklyData, alerts: Alerta[]): Bloque {
  const ses = data.sessions.filter((s) => days.includes(s.date))
  const moved = (d: string) => { const l = logOf(d); return !!l && (Object.values(l.activity ?? {}).some(Boolean) || (l.activity_min ?? 0) > 0 || (l.steps ?? 0) > 0) || ses.some((s) => s.date === d) }
  const suave = (d: string) => inHospital(d) || (ctx(d).day != null && ctx(d).day! >= 5 && ctx(d).day! <= 14) || ctx(d).inCycle
  const adequate = days.filter((d) => {
    if (!moved(d)) return false
    if (suave(d)) return true
    const l = logOf(d)
    return (l?.activity_min ?? 0) >= 15 || ses.some((s) => s.date === d) || (l?.steps ?? 0) >= 3000
  })
  const total = pct(adequate.length, days.length)
  const grade = gradeOf(total, days.filter((d) => !!logOf(d)).length)
  const minutes = days.reduce((a, d) => a + (logOf(d)?.activity_min ?? ses.filter((s) => s.date === d).reduce((x, s) => x + (s.minutes ?? 0), 0)), 0)
  const steps = days.map((d) => logOf(d)?.steps).filter((s): s is number => !!s)
  const fz = ses.filter((s) => s.kind === 'fuerza').length, ae = ses.filter((s) => s.kind === 'aerobico').length
  const func = (ds: string[]) => { const f = ds.map((d) => logOf(d)?.extra?.functional).filter(Boolean).pop(); return f }
  const fNow = func(days), fPrev = func(days.map((d) => addDays(d, -7)))
  const worse = !!(fNow && fPrev && ((fPrev.stairs && fNow.stairs === false) || (fPrev.stands_alone && fNow.stands_alone === false) || (fPrev.walk_min != null && fNow.walk_min != null && fNow.walk_min < fPrev.walk_min)))
  const falls = days.map((d) => ({ d, f: logOf(d)?.extra?.functional?.falls })).filter((x) => x.f && x.f.trim())
  for (const x of falls) alerts.push({ date: x.d, text: `Caída o golpe en el miembro afectado: ${x.f}`, block: 'Ejercicio' })
  const mv = days.reduce((a, d) => { const m = logOf(d)?.extra?.move_after ?? {}; return a + (m.desayuno ? 1 : 0) + (m.comida ? 1 : 0) + (m.cena ? 1 : 0) }, 0)
  const mvPct = pct(mv, days.length * 3)
  const ind: Indicador[] = [
    { label: 'Días con actividad', value: `${days.filter(moved).length} de ${days.length}` },
    { label: 'Minutos', value: `${minutes} en la semana · ${Math.round(minutes / Math.max(1, days.length))} al día` },
    { label: 'Sesiones', value: ses.length ? `${fz} de fuerza · ${ae} de aeróbico${ses.some((s) => s.intensity === 'costo') ? ' · alguna le costó' : ''}` : 'Ninguna' },
    ...(steps.length ? [{ label: 'Pasos', value: `${Math.round(steps.reduce((a, b) => a + b, 0) / steps.length)} al día` }] : []),
    { label: 'Capacidad funcional', value: fNow ? [fNow.stairs ? 'sube escaleras' : fNow.stairs === false ? 'no sube escaleras' : '', fNow.stands_alone ? 'se levanta solo' : '', fNow.walk_min != null ? `paseo de ${fNow.walk_min} min` : ''].filter(Boolean).join(' · ') || 'Sin datos' : 'Sin datos', light: worse ? 'amarillo' : fNow ? 'verde' : 'gris', note: worse ? 'Peor que la semana anterior' : undefined },
    { label: 'Caídas o golpes', value: falls.length ? falls.map((x) => `${dayLabel(x.d)}: ${x.f}`).join(' · ') : 'Ninguno', light: falls.length ? 'rojo' : 'verde' },
    { label: 'Movimiento después de comer', value: `${mv} de ${days.length * 3} comidas (${mvPct} %)` },
  ]
  const advice: string[] = []
  if (worse) advice.push('⚠️ La capacidad funcional ha empeorado respecto a la semana anterior.')
  if (grade === 'Insuficiente' || grade === 'Suficiente') advice.push('En qué mejorar: algo de movimiento cada día, aunque sea corto. En hospital y en los días 5–14 basta con moverse un poco.')
  else if (grade === 'Bueno') advice.push('Seguir: la mayoría de los días se ha movido lo que tocaba.')
  if (mvPct != null && mvPct < 60) advice.push('Moverse unos minutos después de cada comida (pauta de IMOHE).')
  return {
    key: 'ejercicio', title: 'Ejercicio', ico: '🏃', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: `${adequate.length} de ${days.length} días con la actividad de su tramo`, indicators: ind, advice,
    parts: [{ label: 'Días con actividad adecuada', pct: total, detail: '' }, { label: 'Movimiento después de comer', pct: mvPct, detail: '' }],
  }
}

// ---------- 8. Biohacking ----------
function biohacking(days: string[], logOf: (d: string) => DailyLog | undefined, data: WeeklyData): Bloque {
  const logged = days.filter((d) => !!logOf(d))
  const sleepH = (l: DailyLog) => { if (!l.sleep_start || !l.sleep_end) return null; let h = (mins(l.sleep_end) - mins(l.sleep_start)) / 60; if (h < 0) h += 24; return Math.round(h * 10) / 10 }
  // Cena → dormir: la cena de ese día y la hora de dormirse (guardada en el registro del día siguiente o del mismo día).
  const gap = (d: string) => {
    const cena = logOf(d)?.meals.find((m) => m.slot === 'cena')?.time
    const sleep = logOf(addDays(d, 1))?.sleep_start ?? logOf(d)?.sleep_start
    if (!cena || !sleep) return null
    let g = mins(sleep) - mins(cena)
    if (g < -120) g += 24 * 60
    return g
  }
  const gaps = days.map((d) => ({ d, g: gap(d) })).filter((x) => x.g != null) as { d: string; g: number }[]
  const gapOk = gaps.filter((x) => x.g >= 120).length
  const hs = logged.map((d) => sleepH(logOf(d)!)).filter((h): h is number => h != null)
  const wake = logged.map((d) => logOf(d)!.wakeups ?? 0)
  const wakeP = days.map((d) => logOf(addDays(d, -7))?.wakeups).filter((x): x is number => x != null)
  const cause = modeOf(logged.filter((d) => (logOf(d)!.wakeups ?? 0) > 0 && logOf(d)!.wakeup_cause).map((d) => logOf(d)!.wakeup_cause!))
  const naps = logged.filter((d) => (logOf(d)!.nap_min ?? 0) > 0)
  const napAvg = avg(naps.map((d) => logOf(d)!.nap_min!))
  const longNaps = naps.filter((d) => logOf(d)!.nap_min! > RANGOS.napMax)
  const sync = SYNC_ITEMS.map((s) => {
    const done = logged.filter((d) => { const l = logOf(d)!; return !!(l.extra?.sync?.[s.key]?.done ?? l[s.key]) })
    const m = done.map((d) => logOf(d)!.extra?.sync?.[s.key]?.minutes).filter((x): x is number => x != null)
    return { s, p: pct(done.length, logged.length), min: avg(m) }
  })
  const syncVals = sync.map((x) => x.p).filter((p): p is number => p != null)
  const total = syncVals.length ? Math.round(syncVals.reduce((a, b) => a + b, 0) / syncVals.length) : null
  const grade = gradeOf(total, logged.length)
  const cortico = days.filter((d) => corticoidAlert(data.cycles, d))
  const ind: Indicador[] = [
    { label: 'Se duerme 2 h después de cenar', value: gaps.length ? `${gapOk} de ${gaps.length} días · margen medio ${Math.round(gaps.reduce((a, b) => a + b.g, 0) / gaps.length)} min` : 'Sin datos', light: gaps.length ? (gapOk === gaps.length ? 'verde' : 'amarillo') : 'gris' },
    { label: 'Horas de sueño (noche)', value: hs.length ? `Media ${avg(hs)} h · mín. ${Math.min(...hs)} · máx. ${Math.max(...hs)}` : 'Sin datos', light: hs.length ? (avg(hs)! >= RANGOS.sleepH[0] ? 'verde' : 'amarillo') : 'gris', note: 'Recomendado a su edad: 9–12 h' },
    { label: 'Despertares', value: logged.length ? `${avg(wake)} por noche${wakeP.length ? ` (semana anterior ${avg(wakeP)})` : ''}` : 'Sin datos' },
    ...(cause ? [{ label: 'Motivo más frecuente', value: cause, light: (/dolor|náusea/i.test(cause) ? 'amarillo' : 'verde') as Light }] : []),
    { label: 'Siesta', value: naps.length ? `${naps.length} días · ${napAvg} min de media${longNaps.length ? ` · más de 90 min: ${longNaps.map(dayLabel).join(', ')}` : ''}` : 'Ningún día' },
    ...sync.map((x) => ({ label: x.s.label, value: x.p == null ? 'Sin datos' : `${x.p} % de los días${x.min ? ` · ${x.min} min de media` : ''}`, light: GRADE_LIGHT[gradeOf(x.p)] })),
    ...(cortico.length ? [{ label: 'Noches con corticoide', value: cortico.map(dayLabel).join(', '), note: 'El corticoide quita sueño: esas noches no cuentan como fallo de la rutina' }] : []),
  ]
  const advice: string[] = []
  if (gaps.length && gapOk < gaps.length) advice.push('Dormirse antes de 2 h tras la cena: la digestión no ha terminado; puede haber más reflujo, peor sueño y azúcar más alto por la noche, y el ayuno nocturno empieza más tarde.')
  if (hs.length && avg(hs)! < RANGOS.sleepH[0]) advice.push('Pocas horas de sueño: más cansancio al día siguiente, peor ánimo y peor tolerancia al tratamiento.')
  if (cause && /dolor|náusea/i.test(cause)) advice.push(`Se despierta sobre todo por ${cause.toLowerCase()}: comentarlo con oncología.`)
  if (longNaps.length) advice.push('Siestas de más de 90 minutos: pueden quitar sueño por la noche.')
  const low = sync.filter((x) => x.p != null && x.p < 60)
  if (low.some((x) => x.s.key === 'daylight_morning')) advice.push('Poca luz natural por la mañana: el reloj interno se retrasa y cuesta más dormirse por la noche.')
  if (low.some((x) => x.s.key === 'glasses')) advice.push('Sin gafas de luz azul por la noche: la luz de pantallas retrasa la melatonina y el sueño.')
  if (grade === 'Bueno' || grade === 'Excelente') { const w = [...sync].filter((x) => x.p != null).sort((a, b) => a.p! - b.p!)[0]; if (w && w.p! < 100) advice.push(`Seguir insistiendo en: ${w.s.label.toLowerCase()} (${w.p} %).`) }
  return {
    key: 'biohacking', title: 'Biohacking', ico: '🌙', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin datos' : `Sincronizadores ${total} %`, indicators: ind, advice,
    parts: [
      ...sync.filter((x) => x.p != null).map((x) => ({ label: x.s.label, pct: x.p, detail: '' })),
      ...(gaps.length ? [{ label: 'Dormir 2 h después de cenar', pct: pct(gapOk, gaps.length), detail: '' }] : []),
    ],
  }
}

/** Días de la semana (lunes) de una fecha cualquiera. */
export { weekStart } from './dates'
