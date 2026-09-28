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
import { controlDelDia, nauseaMax, resumenesRecientes } from './nausea'
import { sesionesTratamiento } from './fases'

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
  /** Acciones concretas para la semana que viene (se reúnen arriba, en «Qué hacer la semana que viene»). */
  actions?: string[]
  /** Explicaciones para el apartado OJO (signos y síntomas, vómitos). */
  ojo?: Ojo[]
  /** Apartados de texto dentro del bloque (p. ej. «Valoración» en nutrición). */
  sections?: { title: string; lines: string[] }[]
}
export interface Ojo { title: string; text: string; light: Light; pregunta?: string }
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
  /** Acciones de cada apartado con nota insuficiente o suficiente (o semáforo en vigilar/avisar). */
  acciones: { title: string; ico: string; grade: string; items: string[] }[]
  /** Apartado OJO: explicación de lo importante en signos y síntomas y en vómitos. */
  ojo: Ojo[]
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
    hidratacion(days, logOf, ctx, modeOfDay, data),
    ejercicio(days, logOf, ctx, inHospital, data, alerts),
    biohacking(days, logOf, data),
  ]

  // Tres cosas a mejorar y tres a mantener: las partes con porcentaje más bajo y más alto.
  const parts = blocks.flatMap((b) => (b.parts ?? []).filter((p) => p.pct != null).map((p) => ({ ...p, block: b.title })))
  const sorted = [...parts].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
  const mejorar = sorted.filter((p) => (p.pct ?? 100) < 95).slice(0, 3).map((p) => `${p.block} · ${p.label}: ${p.pct} %${p.detail ? ` (${p.detail})` : ''}`)
  const mantener = sorted.reverse().filter((p) => (p.pct ?? 0) >= 80).slice(0, 3).map((p) => `${p.block} · ${p.label}: ${p.pct} %`)

  const corticoidNights = days.filter((d) => corticoidAlert(data.cycles, d))
  const acciones = blocks
    .filter((b) => (b.actions?.length ?? 0) > 0 && (b.grade === 'Insuficiente' || b.grade === 'Suficiente' || (!b.grade && (b.light === 'rojo' || b.light === 'amarillo'))))
    .map((b) => ({ title: b.title, ico: b.ico, grade: b.grade ?? (b.light === 'rojo' ? 'Avisar' : 'Vigilar'), items: b.actions! }))
  const ojo = blocks.flatMap((b) => b.ojo ?? [])
  return { weekStart: ws, weekEnd: all[6], days, header, alerts: alerts.sort((a, b) => a.date.localeCompare(b.date)), blocks, mejorar, acciones, ojo, mantener, corticoidNights }
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
  const ojo: Ojo[] = []
  const hardDays = logs.filter(([, l]) => l.bristol != null && l.bristol <= 2).map(([d]) => d)
  const noStoolDays = logs.filter(([, l]) => l.stools_n === 0).map(([d]) => d)
  if (estr) {
    bump('amarillo')
    const first = [...noStoolDays, ...hardDays].sort()[0] ?? logs.find(([, l]) => (l.symptoms?.estrenimiento ?? 0) > 0)?.[0] ?? days[0]
    alerts.push({ date: first, text: `Estreñimiento${maxRun >= 2 ? ` (${maxRun} días seguidos sin deposición)` : ''}${hardDays.length ? ` · heces duras (Bristol 1–2) ${hardDays.length} día${hardDays.length > 1 ? 's' : ''}` : ''}`, block: B })
    ojo.push({
      title: 'Estreñimiento', light: 'amarillo',
      text: `${hardDays.length ? `Heces duras (Bristol 1–2) ${hardDays.length} de ${bristols.length} días apuntados (${hardDays.map(dayLabel).join(', ')}); Bristol medio ${avg(bristols)}. ` : ''}${noStoolDays.length ? `Días sin deposición: ${noStoolDays.map(dayLabel).join(', ')}${maxRun >= 2 ? ` (${maxRun} seguidos)` : ''}. ` : ''}Algunos antieméticos (como el ondansetrón), la quimio, beber poco y moverse menos favorecen el estreñimiento, y el estreñimiento a su vez quita apetito y da náuseas. Conviene comentarlo con el equipo por si necesita una pauta para el estreñimiento, y reforzar líquidos, verdura cocida y movimiento.`,
      pregunta: 'Estreñimiento esta semana (heces duras / días sin deposición). ¿Necesita pauta para el estreñimiento?',
    })
  }
  ind.push({ label: 'Diarrea', value: diarreaDays.length ? `Sí · ${diarreaDays.map(dayLabel).join(', ')}` : 'No', light: diarreaFiebre ? 'rojo' : diarreaDays.length ? 'amarillo' : 'verde' })
  if (diarreaDays.length) {
    bump(diarreaFiebre ? 'rojo' : 'amarillo')
    if (!diarreaFiebre) alerts.push({ date: diarreaDays[0], text: `Diarrea (${diarreaDays.map(dayLabel).join(', ')})`, block: B })
    ojo.push({ title: 'Diarrea', light: diarreaFiebre ? 'rojo' : 'amarillo', text: `Deposiciones líquidas (Bristol 6–7, 3 o más al día): ${diarreaDays.map(dayLabel).join(', ')}.${diarreaFiebre ? ' Con fiebre: hay que avisar al equipo.' : ''} La diarrea hace perder líquidos y sales: reponer con caldo salado y agua a sorbos, y avisar si no retiene o hay fiebre.`, pregunta: 'Diarrea esta semana. ¿Qué hacemos?' })
  }
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
  if (feverDays.length || lowRepeated.length) ojo.push({ title: 'Fiebre', light: 'rojo', text: `${feverDays.length ? `Fiebre de 38 °C o más: ${feverDays.map(dayLabel).join(', ')} (máxima ${tmax} °C). ` : ''}${lowRepeated.length ? `37,5 °C o más repetida: ${lowRepeated.map(dayLabel).join(', ')}. ` : ''}En tratamiento con quimio, la fiebre se avisa siempre al equipo antes de dar antitérmico, sobre todo en los días 7–14 (defensas bajas).` })

  // Constantes
  const vit: { d: string; slot: string; v: VitalEntry }[] = []
  for (const [d, l] of logs) for (const [slot, v] of Object.entries(l.extra?.vitals ?? {})) if (v) vit.push({ d, slot, v })
  const slotName: Record<string, string> = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
  const constante = (label: string, has: (v: VitalEntry) => boolean, ok: (v: VitalEntry) => boolean, show: (v: VitalEntry) => string, rango: string, why = '') => {
    const title = label
    const xs = vit.filter((x) => has(x.v))
    if (!xs.length) { ind.push({ label, value: 'Sin datos', light: 'gris', note: rango }); return }
    const bad = xs.filter((x) => !ok(x.v))
    const p = pct(xs.length - bad.length, xs.length)!
    const light: Light = bad.length ? 'amarillo' : 'verde'
    bump(light)
    ind.push({ label, value: `${p} % en rango (${xs.length} tomas)`, light, note: bad.length ? `Fuera de rango: ${bad.slice(0, 6).map((x) => `${dayLabel(x.d)} ${slotName[x.slot] ?? x.slot} ${show(x.v)}`).join(' · ')}` : rango })
    if (bad.length) ojo.push({ title, light: 'amarillo', text: `${bad.length} de ${xs.length} tomas fuera de rango (${rango.replace(/^Rango: /, '')}): ${bad.slice(0, 6).map((x) => `${dayLabel(x.d)} por la ${slotName[x.slot] ?? x.slot}, ${show(x.v)}`).join('; ')}. ${bad.length === 1 ? 'Es una toma aislada: repetirla en reposo. ' : 'Se repite: comentarlo con el equipo. '}${why}` })
  }
  constante('Tensión arterial', (v) => v.sys != null, (v) => v.sys! >= RANGOS.sys[0] && v.sys! <= RANGOS.sys[1] && (v.dia == null || v.dia <= RANGOS.diaMax), (v) => `${v.sys}/${v.dia ?? '—'}`, 'Rango: sistólica 86–110 y diastólica hasta 73 mmHg', 'Tensión baja con mareo, palidez o poca orina puede ser falta de líquidos; tensión alta repetida se comenta con oncología.')
  constante('Pulso', (v) => v.pulse != null, (v) => v.pulse! >= RANGOS.pulse[0] && v.pulse! <= RANGOS.pulse[1], (v) => `${v.pulse} lpm`, 'Rango: 75–118 lpm', 'Un pulso algo bajo dormido o muy tranquilo puede ser normal; un pulso alto en reposo puede deberse a fiebre, dolor, nervios o falta de líquidos.')
  const sat = vit.filter((x) => x.v.spo2 != null)
  if (sat.length) {
    const low = Math.min(...sat.map((x) => x.v.spo2!))
    const ok = sat.filter((x) => x.v.spo2! >= RANGOS.spo2Ok).length
    const light: Light = low < 94 ? 'rojo' : low < RANGOS.spo2Ok ? 'amarillo' : 'verde'
    bump(light)
    for (const x of sat.filter((x) => x.v.spo2! < 94)) alerts.push({ date: x.d, text: `Saturación ${x.v.spo2} % (${slotName[x.slot] ?? x.slot})`, block: B })
    ind.push({ label: 'Saturación de oxígeno', value: `${pct(ok, sat.length)} % en rango · la más baja ${low} %`, light, note: '95 % o más en rango; 94 % vigilar; menos de 94 % avisar' })
    if (low < RANGOS.spo2Ok) ojo.push({ title: 'Saturación de oxígeno', light, text: `La más baja fue ${low} %. ${low < 94 ? 'Por debajo del 94 % hay que avisar al equipo, más aún con tos, fatiga al respirar o dolor en el pecho.' : 'Un 94 % aislado se vigila: repetir con el niño tranquilo y las manos calientes.'}` })
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
  if (fat != null && fat >= 3) ojo.push({ title: 'Cansancio', light: 'amarillo', text: `Fatiga media de ${fat} sobre 4 (descansa más de lo normal o está casi todo el día tumbado). Revisar si coincide con días de poca comida o bebida, anemia o mal sueño.` })
  if (mood != null && mood <= 2) ojo.push({ title: 'Ánimo', light: 'amarillo', text: `Ánimo medio de ${mood} sobre 5. Hablarlo en casa y, si sigue así, con la psicóloga.` })
  if (painMax != null && painMax >= 4) ojo.push({ title: 'Dolor', light: painMax >= 7 ? 'rojo' : 'amarillo', text: `Dolor máximo ${painMax}/10${where.length ? ` (${where.join(', ')})` : ''}. Un dolor nuevo o que aumenta en la zona del tumor, o que le despierta por la noche, se comenta con oncología.` })
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
    if (def?.redAt3 && max >= 3) { bump('rojo'); alerts.push({ date: vals.find((x) => x.v === 3)!.d, text: `${label}: intenso`, block: B }); if (k !== 'vomitos') ojo.push({ title: label, light: 'rojo', text: `Llegó a intenso el ${dayLabel(vals.find((x) => x.v === 3)!.d)} (${vals.length} día${vals.length > 1 ? 's' : ''} en la semana). Es de los síntomas que, intensos, se avisan al equipo.` }) }
    else bump('amarillo')
  }
  const phlegm = logs.filter(([, l]) => l.extra?.phlegm_color === 'verde' || l.extra?.phlegm_color === 'rojo')
  for (const [d, l] of phlegm) { notable.push(`Flemas ${l.extra!.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'} (${dayLabel(d)})`); alerts.push({ date: d, text: `Flemas ${l.extra!.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'}`, block: B }); bump('rojo') }
  for (const [d, l] of phlegm) ojo.push({ title: 'Flemas', light: 'rojo', text: `Flemas ${l.extra!.phlegm_color === 'rojo' ? 'con sangre' : 'verdes'} el ${dayLabel(d)}: pueden indicar infección. Avisar al equipo.` })
  void notable

  const light: Light = logs.length ? worst : 'gris'
  return {
    key: 'signos', title: B, ico: '📝', light,
    summary: light === 'gris' ? 'Sin registros' : light === 'verde' ? 'Todo en rango' : light === 'amarillo' ? 'Hay cosas a vigilar' : 'Hay alertas: ver arriba',
    indicators: ind,
    advice: [],
    ojo,
    actions: [
      ...(estr ? ['Estreñimiento: más líquidos a sorbos, verdura cocida de fibra soluble y moverse después de comer; preguntar al equipo por una pauta para el estreñimiento.'] : []),
      ...(diarreaDays.length ? ['Diarrea: reponer con caldo salado y agua a sorbos; avisar si no retiene o hay fiebre.'] : []),
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
    ind.push({ label: name, value: `${p} %`, light: GRADE_LIGHT[gradeOf(p)], note: det ? `Hacer hincapié en: ${det}` : undefined })
  }
  const total = pct(H, P)
  const grade = gradeOf(total, days.filter((d) => !!logOf(d)).length)
  const worst = [...parts].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0]
  const advice: string[] = []
  if (worst && (worst.pct ?? 100) < 95) advice.push(`A mejorar: ${worst.label} (${worst.pct} %)${worst.detail ? `. Hacer hincapié en: ${worst.detail}.` : '.'}`)
  const actions = parts.filter((p) => (p.pct ?? 100) < 80 && p.detail).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)).map((p) => `${p.label} (${p.pct} %): hacer hincapié en ${p.detail.replace(/:.*$/, '')}.`)
  // Cruce con síntomas
  const boca = days.some((d) => (logOf(d)?.symptoms?.mucositis ?? 0) > 0)
  const piel = days.some((d) => (logOf(d)?.symptoms?.piel ?? 0) > 0)
  const pBoca = parts.find((p) => p.label === 'Boca')?.pct ?? 100
  const pPiel = parts.find((p) => p.label === 'Piel y pelo')?.pct ?? 100
  if (boca && pBoca < 80) advice.push(`⚠️ Esta semana hubo llagas o dolor de boca y los cuidados de boca están al ${pBoca} %.`)
  if (piel && pPiel < 80) advice.push(`⚠️ Esta semana hubo problemas de piel y los cuidados de piel y pelo están al ${pPiel} %.`)
  if (!advice.length && total != null) advice.push('Seguir igual: los cuidados se están haciendo casi todos los días.')
  return { key: 'preventivos', title: 'Cuidados preventivos', ico: '🧴', grade, pct: total, light: GRADE_LIGHT[grade], summary: total == null ? 'Sin datos' : `${total} % cumplido`, indicators: ind, advice, parts, actions }
}

// ---------- 3. Vómitos: informe para valorar con el equipo si la pauta antiemética es suficiente ----------
const ANTIEMETIC_RE = /ondansetr|granisetr|palonosetr|aprepitant|fosaprepitant|dexametas|metoclopr|domperid|nux|arsenicum/i
function vomitos(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData, alerts: Alerta[]): Bloque {
  const B = 'Vómitos y náuseas'
  const eps = days.flatMap((d) => (logOf(d)?.extra?.vomits ?? []).map((e) => ({ d, ...e })))
  const vdays = days.filter((d) => (logOf(d)?.extra?.vomits?.length ?? 0) > 0 || logOf(d)?.extra?.vomit_no_liquids)
  const sev = days.map((d) => ({ d, s: vomitSeverity(logOf(d)?.extra) }))
  const worst = [...sev].sort((a, b) => b.s - a.s)[0]
  const kindLabel = (k?: string | null) => VOMIT_KINDS.find((x) => x.value === k)?.label.toLowerCase() ?? 'sin tipo'
  const noLiq = days.filter((d) => logOf(d)?.extra?.vomit_no_liquids)
  // Náuseas (0.25.0): escala 0-10 si está apuntada (si no, la escala antigua), control del día y rescates.
  const nau = (d: string) => { const l = logOf(d); const m = nauseaMax(l?.extra?.nausea); return m != null ? m : [0, 2, 5, 8][l?.symptoms?.nauseas ?? 0] ?? 0 }
  const nauDays = days.filter((d) => nau(d) > 0)
  const nauMod = days.filter((d) => nau(d) >= 5)
  const nauMaxDay = nauDays.length ? [...nauDays].sort((a, b) => nau(b) - nau(a))[0] : null
  const ctrl = days.map((d) => ({ d, c: controlDelDia(logOf(d)) })).filter((x) => x.c)
  const ctrlOk = ctrl.filter((x) => x.c!.nivel === 'verde').length
  const ctrlRojo = ctrl.filter((x) => x.c!.nivel === 'rojo')
  const rescDia = (d: string) => logOf(d)?.extra?.nausea?.rescates ?? []
  const resc = days.flatMap(rescDia)
  const rescOk = resc.filter((r) => r.efecto === 'si').length
  const antic = days.filter((d) => logOf(d)?.extra?.nausea?.anticipatoria)
  const sesionesSemana = resumenesRecientes(data.patient?.protocol_start, data.cycles, data.logs, days[days.length - 1] ?? addDays(days[0] ?? todayStr(), 6), 3)
    .filter((r) => r.sesion >= addDays(days[0] ?? todayStr(), -6) && (r.aguda.dias + r.retardada.dias) > 0)
  const retardadaMal = sesionesSemana.filter((r) => r.retardada.dias && r.retardada.completos < r.retardada.dias / 2)
  for (const x of ctrlRojo) alerts.push({ date: x.d, text: `Náuseas sin control (${x.c!.motivos.slice(0, 2).join(', ')})`, block: B })
  // Rescate: tomas dadas de antieméticos o de la homeopatía para las náuseas, más los rescates apuntados en Náuseas.
  const rescueProducts = data.products.filter((p) => ANTIEMETIC_RE.test(p.name))
  const rescueOf = (d: string) => rescueProducts.map((p) => ({ p, n: data.intakes.filter((i) => i.product_id === p.id && i.date === d && (i.status === 'dada' || i.taken)).length })).filter((x) => x.n > 0)
  const rescueTotal = days.reduce((a, d) => a + rescueOf(d).reduce((x, r) => x + r.n, 0), 0) + resc.length
  const lostOf = (d: string) => data.intakes.filter((i) => i.date === d && i.status === 'no_dada' && /v[oó]mito/i.test(i.reason ?? '')).length
  const lost = days.reduce((a, d) => a + lostOf(d), 0)
  const red = eps.some((e) => VOMIT_KINDS.find((k) => k.value === e.kind)?.alerta) || noLiq.length > 0
  for (const e of eps.filter((e) => VOMIT_KINDS.find((k) => k.value === e.kind)?.alerta)) alerts.push({ date: e.d, text: `Vómito ${kindLabel(e.kind)}`, block: B })
  for (const d of noLiq) alerts.push({ date: d, text: 'No retiene ni líquidos', block: B })
  const light: Light = red ? 'rojo' : sev.some((x) => x.s >= 2) || vdays.length >= 2 || nauMod.length >= 2 || ctrlRojo.length > 0 || retardadaMal.length > 0 ? 'amarillo' : 'verde'
  // Pauta antiemética registrada en Tratamiento (ciclos que tocan esta semana).
  const cyc = data.cycles.filter((c) => { const s0 = (c.start_at ?? c.planned_date).slice(0, 10); return s0 <= days[days.length - 1] && s0 >= addDays(days[0], -10) })
  const pauta: string[] = []
  for (const c of cyc) {
    const a = c.antiemetic
    const items = (a?.items ?? []).filter((m) => m.name).map((m) => `${m.name}${m.mg ? ` ${m.mg}` : ''}${m.posology ? ` (${m.posology})` : ''}${m.sufficient ? ` · ¿suficiente?: ${m.sufficient}` : ''}`)
    const between = (c.other_meds?.between ?? []).filter((m) => ANTIEMETIC_RE.test(m.name)).map((m) => `${m.name}${m.posology ? ` (${m.posology})` : ''}`)
    const txt = [...items, ...(a?.drug ? [a.drug + (a.scheme ? ` (${a.scheme})` : '')] : []), ...between]
    if (txt.length) pauta.push(`Ciclo ${c.number} (${c.drugs.join(' + ')}): ${Array.from(new Set(txt)).join('; ')}`)
  }
  // Tabla día a día para el equipo.
  const rows = days.map((d) => {
    const c = ctx(d)
    const e = logOf(d)?.extra?.vomits ?? []
    const r = rescueOf(d)
    return [
      dayLabel(d),
      c.day != null && c.day >= 0 && c.cycle ? `D${c.day} ${c.cycle.drugs.join('+')}` : '—',
      nau(d) ? `${nau(d)}/10` : 'no',
      e.length ? `${e.length}: ${e.map((x) => `${x.time || '?'} ${kindLabel(x.kind)}`).join(', ')}` : '0',
      [...r.map((x) => `${x.p.name.replace(/ 30 CH.*$/, '')} ×${x.n}`), ...rescDia(d).map((x) => `${x.time ? x.time + ' ' : ''}${x.med || 'rescate'}${x.efecto === 'si' ? ' (eficaz)' : x.efecto === 'no' ? ' (no eficaz)' : ''}`)].join(', ') || '—',
      logOf(d)?.extra?.vomit_no_liquids ? 'NO' : e.length ? 'sí' : '—',
      lostOf(d) ? String(lostOf(d)) : '—',
    ]
  })
  // Valoración: ¿está siendo suficiente la pauta?
  const maxEp = Math.max(0, ...days.map((d) => logOf(d)?.extra?.vomits?.length ?? 0))
  const insuf = vdays.length >= 2 || maxEp >= 3 || nauMod.length >= 2 || red || rescueTotal >= 4 || ctrlRojo.length > 0 || retardadaMal.length > 0
  const afterChemo = Array.from(new Set(vdays.map((d) => ctx(d)).filter((c) => c.day != null && c.day >= 0 && c.cycle).map((c) => `D${c.day}`)))
  const hechos = [
    vdays.length ? `vómitos ${vdays.length} de ${days.length} días (${eps.length} episodios${afterChemo.length ? `, ${afterChemo.join(', ')} tras la quimio` : ''}; hasta ${maxEp} el ${dayLabel(worst.d)})` : 'sin vómitos',
    nauDays.length ? `náuseas ${nauDays.length} día${nauDays.length > 1 ? 's' : ''} (${nauMod.length} moderada${nauMod.length === 1 ? '' : 's'} o intensa${nauMod.length === 1 ? '' : 's'})` : 'sin náuseas',
    rescueTotal ? `rescate usado ${rescueTotal} ${rescueTotal > 1 ? 'veces' : 'vez'}${resc.length ? ` (${rescOk} eficaz${rescOk === 1 ? '' : 'es'})` : ''}` : 'sin rescate',
    ...(ctrl.length ? [`control completo ${ctrlOk} de ${ctrl.length} días`] : []),
    ...retardadaMal.map((r) => `náusea retardada mal controlada tras ${r.titulo.toLowerCase().replace(/ del .*/, '')} (${r.retardada.completos} de ${r.retardada.dias} días)`),
    ...(antic.length ? [`náusea anticipatoria: ${antic.map(dayLabel).join(', ')}`] : []),
    ...(lost ? [`${lost} toma${lost > 1 ? 's' : ''} perdida${lost > 1 ? 's' : ''} por vómito`] : []),
    ...(noLiq.length ? [`no retuvo líquidos: ${noLiq.map(dayLabel).join(', ')}`] : []),
  ]
  const valoracion = insuf
    ? `Según lo registrado, la pauta antiemética no está siendo suficiente: ${hechos.join('; ')}. Llevar esta tabla al equipo para valorar si hay que ajustar la pauta.`
    : eps.length || nauDays.length
      ? `Según lo registrado, la pauta antiemética parece suficiente esta semana: ${hechos.join('; ')}.`
      : 'Sin náuseas ni vómitos esta semana: la pauta antiemética está funcionando.'
  const ind: Indicador[] = [
    { label: 'Pauta antiemética registrada', value: pauta.length ? pauta.join(' · ') : 'No hay pauta apuntada en Tratamiento para estos ciclos', note: pauta.length ? undefined : 'Apuntarla en Tratamiento (protocolo antiemético) para que salga aquí' },
    { label: 'Episodios', value: eps.length ? `${eps.length} en ${vdays.length} día${vdays.length > 1 ? 's' : ''}${worst && worst.s > 0 ? ` · peor día ${dayLabel(worst.d)} (${['', 'leve', 'moderado', 'intenso'][worst.s]})` : ''}` : 'Ninguno', light },
    { label: 'Náuseas', value: nauDays.length ? `${nauDays.length} día${nauDays.length > 1 ? 's' : ''} · máximo ${nau(nauMaxDay!)}/10 (${dayLabel(nauMaxDay!)})` : 'Ninguna' },
    ...(ctrl.length ? [{ label: 'Control completo de náuseas y vómitos', value: `${ctrlOk} de ${ctrl.length} días`, light: (ctrlRojo.length ? 'rojo' : ctrlOk === ctrl.length ? 'verde' : 'amarillo') as Light }] : []),
    ...sesionesSemana.map((r) => ({ label: r.titulo, value: `aguda ${r.aguda.dias ? `${r.aguda.completos}/${r.aguda.dias}` : '—'} · retardada ${r.retardada.dias ? `${r.retardada.completos}/${r.retardada.dias}` : '—'} días con control completo`, light: (r.retardada.dias && r.retardada.completos < r.retardada.dias / 2 ? 'rojo' : r.aguda.completos + r.retardada.completos === r.aguda.dias + r.retardada.dias ? 'verde' : 'amarillo') as Light })),
    ...(antic.length ? [{ label: 'Náusea anticipatoria', value: antic.map(dayLabel).join(', '), light: 'amarillo' as Light }] : []),
    { label: 'Rescate usado', value: rescueTotal ? `${rescueTotal} ${rescueTotal > 1 ? 'veces' : 'vez'}` : 'Ninguno' },
  ]
  return {
    key: 'vomitos', title: 'Vómitos y náuseas', ico: '🤢', light,
    summary: eps.length ? `${eps.length} episodio${eps.length > 1 ? 's' : ''} en ${vdays.length} día${vdays.length > 1 ? 's' : ''} · pauta ${insuf ? 'insuficiente' : 'suficiente'}` : nauDays.length ? `Sin vómitos · náuseas ${nauDays.length} día${nauDays.length > 1 ? 's' : ''}` : 'Sin vómitos',
    indicators: ind,
    table: { head: ['Día', 'Tras la quimio', 'Náuseas (0–10)', 'Vómitos (hora y tipo)', 'Rescate', '¿Retiene líquidos?', 'Tomas perdidas'], rows },
    advice: [
      valoracion,
      ...(antic.length ? ['Ha habido náusea anticipatoria (antes de la quimio): comentarlo con el equipo, se trata distinto.'] : []),
    ],
    ojo: eps.length || nauMod.length || ctrlRojo.length || retardadaMal.length ? [{ title: 'Vómitos y náuseas', light: insuf ? (red ? 'rojo' : 'amarillo') : 'verde', text: valoracion, pregunta: insuf ? `Vómitos y náuseas esta semana: ${hechos.join('; ')}. ¿Hay que ajustar la pauta antiemética?` : undefined }] : [],
    actions: insuf ? ['Llevar al equipo la tabla de vómitos y náuseas (en el bloque «Vómitos y náuseas») para valorar la pauta antiemética.', ...(nauDays.length ? ['Dar el rescate pautado en cuanto aparezcan las náuseas, sin esperar al vómito, y apuntarlo con su efecto.'] : [])] : [],
  }
}

// ---------- 4. Suplementación (y medicación del hospital aparte) ----------
/** Día «de quimio» para la suplementación: semana de quimio (metotrexato o cisplatino) o las 48 h antes de una sesión.
 *  Esos días solo cuentan los suplementos «en ciclo»; los de «fuera de ciclo» están retirados. */
function chemoDaySet(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData) {
  const ses = sesionesTratamiento(data.patient?.protocol_start, data.cycles).filter((x) => x.kind !== 'cirugia')
  return new Set(days.filter((d) => weekMode(logOf(d), ctx(d)) === 'quimio' || ses.some((x) => x.date > d && x.date <= addDays(d, 2))))
}
const MOMENTO_FRASE: Record<string, string> = { ayunas: 'en ayunas', 'mañana': 'por la mañana', 'media mañana': 'a media mañana', comida: 'con la comida', 'media tarde': 'a media tarde', cena: 'con la cena', 'antes de dormir': 'antes de dormir' }
function suplementos(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, data: WeeklyData): Bloque {
  const MOM: Record<string, string> = { ayunas: 'ayunas', manana: 'mañana', media_manana: 'media mañana', comida: 'comida', media_tarde: 'media tarde', cena: 'cena', dormir: 'antes de dormir' }
  const chemo = chemoDaySet(days, logOf, ctx, data)
  const per = new Map<string, { name: string; previstas: number; dadas: number; noDadas: number; reasons: string[]; misses: string[] }>()
  const reasons: string[] = []
  const missMoments: string[] = []
  const missPhase = { 'días de quimio': [0, 0], 'días de nadir': [0, 0] } as Record<string, [number, number]>
  const missSymptomDays = new Set<string>()
  const hospitalMisses: string[] = []
  for (const d of days) {
    const c = ctx(d)
    const wk = trafficWindow(c, d)
    const dow = new Date(d + 'T12:00').getDay()
    const l = logOf(d)
    const enHospital = HOSPITAL.has(l?.location ?? '')
    const isChemo = chemo.has(d)
    const phase = isChemo ? 'días de quimio' : 'días de nadir'
    for (const p of data.products) {
      if (p.end_date && p.end_date <= d) continue
      if (p.start_date && p.start_date > d) continue
      if (!p.moments?.length || p.condition) continue
      if (p.weekdays?.length && !p.weekdays.includes(dow)) continue
      if (afterChemoGate(p, data.cycles, d)?.waiting) continue
      if (wk && p.traffic?.[wk] === 'rojo') continue
      if (isChemo && p.block === 'sup_fuera') continue // en semana de quimio solo valen los de «en ciclo»
      for (const m of p.moments) {
        const it = data.intakes.find((i) => i.product_id === p.id && i.date === d && i.moment === m)
        if (it?.status === 'no_precisa') continue
        const given = !!(it?.taken || it?.status === 'dada')
        if (p.block === 'hospital') {
          // En el hospital la medicación la pone enfermería: solo se revisa la de casa.
          if (!given && !enHospital) hospitalMisses.push(`${p.name} · ${dayLabel(d)} ${MOM[m] ?? m}${it?.status === 'no_dada' ? ` · ${it.reason ?? 'no dada'}` : ' · sin marcar'}`)
          continue
        }
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
  const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const rc = count(reasons)
  const mc = count(missMoments)
  const sinMarcar = reasons.filter((r) => r === 'Sin marcar').length
  const advice: string[] = []
  const actions: string[] = []
  const reglas = chemo.size === days.length ? 'Semana de quimio: solo cuentan los suplementos «en ciclo»; los de «fuera de ciclo» están retirados.' : chemo.size ? `Días de quimio (${[...chemo].map(dayLabel).join(', ')}): solo cuentan los suplementos «en ciclo». El resto de días, todo el plan.` : 'Semana de nadir: cuenta todo el plan de suplementación.'
  advice.push(reglas)
  if (grade === 'Insuficiente' || grade === 'Suficiente') {
    advice.push('Qué lo está afectando:')
    if (rc.length) advice.push('· Motivos: ' + rc.map(([k, n]) => `${k.toLowerCase()} ${n}`).join(', '))
    if (mc.length) advice.push(`· Momento del día con más tomas perdidas: ${mc[0][0]} (${mc[0][1]})`)
    const ph = Object.entries(missPhase).filter(([, [, t]]) => t > 0).map(([k, [m, t]]) => `${k} ${Math.round((m / t) * 100)} % sin dar`)
    if (ph.length > 1) advice.push('· Por fase: ' + ph.join(', '))
    if (missSymptomDays.size) advice.push(`· Días con náuseas, vómitos o llagas en los que se perdieron tomas: ${[...missSymptomDays].map(dayLabel).join(', ')}`)
    if (dificil.length) advice.push('Suplementos con dificultad: ' + dificil.map((r) => `${r.name} (${pct(r.dadas, r.previstas)} %)`).join(', '))
  } else if (grade === 'Bueno' || grade === 'Excelente') {
    const low = rows[0]
    if (low && low.dadas < low.previstas) advice.push(`Seguir insistiendo en ${low.name} (${pct(low.dadas, low.previstas)} %).`)
    else advice.push('Todas las tomas previstas se han dado.')
  }
  for (const r of dificil.slice(0, 4)) {
    const why = modeOf(r.reasons)
    const when = modeOf(r.misses)
    actions.push(`${r.name}: ${r.dadas} de ${r.previstas}. ${why === 'Sin marcar' ? `Darlo ${when ? (MOMENTO_FRASE[when] ?? when) : ''} y marcarlo al momento.` : /no quiso/i.test(why ?? '') ? 'No lo quiere: preguntar a la doctora por otro formato o mezclarlo con algo que le guste.' : /molestias/i.test(why ?? '') ? 'Le sienta mal: preguntar si se puede tomar con comida o cambiar de momento.' : /v[oó]mito/i.test(why ?? '') ? 'Se pierde por vómitos: darlo cuando las náuseas estén controladas.' : 'Revisar por qué no se da.'}`.replace(/\s+/g, ' '))
  }
  if (sinMarcar >= 5) actions.push(`Hay ${sinMarcar} tomas sin marcar: marcar cada toma al darla (si se dieron y no se apuntaron, el informe no lo sabe).`)
  if (mc.length && mc[0][1] >= 3) actions.push(`El momento que más falla es ${mc[0][0]}: dejar preparados los suplementos de ese momento junto a la comida o en un sitio a la vista.`)
  if (hospitalMisses.length) advice.push('Medicación del hospital no dada en casa:', ...hospitalMisses.map((h) => '· ' + h))
  if (hospitalMisses.length) actions.push(`Medicación del hospital: ${hospitalMisses.length} toma${hospitalMisses.length > 1 ? 's' : ''} en casa sin marcar o no dadas; revisarlas (es la que no debe fallar).`)
  return {
    key: 'suplementos', title: 'Suplementación', ico: '💊', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin tomas previstas' : `${D} de ${P} tomas dadas (${total} %)`,
    indicators: [{ label: 'Medicación del hospital (en casa)', value: hospitalMisses.length ? `${hospitalMisses.length} toma${hospitalMisses.length > 1 ? 's' : ''} sin dar o sin marcar` : 'Todas dadas o sin tomas previstas', light: hospitalMisses.length ? 'rojo' : 'verde' }],
    advice, actions,
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
  // ---------- Valoración: qué no come, qué comida cuesta más y por qué pierde peso ----------
  const SLOTS: { k: string; n: string }[] = [{ k: 'desayuno', n: 'el desayuno' }, { k: 'comida', n: 'la comida' }, { k: 'merienda', n: 'la merienda' }, { k: 'cena', n: 'la cena' }]
  const fatN = (m: Meal) => m.macros?.fat_n ?? (m.macros?.fat == null ? 0 : m.macros.fat ? 1 : 0)
  const score = (m: Meal | undefined): number | null => {
    if (!m) return null
    if (m.fraction === 0) return 0
    if (m.fraction != null) return m.fraction
    const mc = m.macros
    if (mc && (mc.veg != null || mc.prot != null || mc.fat_n != null || mc.fat != null)) return ((mc.veg ?? 0) / 2 + (mc.prot ?? 0) / 2 + Math.min(fatN(m), 2) / 2) / 3
    return m.note || m.amount ? 0.5 : null
  }
  const porComida = SLOTS.map((sl) => {
    const ms = logged.map((d) => logOf(d)!.meals.find((m) => m.slot === sl.k))
    const sc = ms.map(score).filter((x): x is number => x != null)
    return { ...sl, media: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, nada: ms.filter((m) => m?.fraction === 0).length, sinApuntar: ms.filter((m) => !m || score(m) == null).length, cnt: sc.length }
  }).filter((x) => x.cnt >= 2)
  const peor = [...porComida].sort((a, b) => (a.media ?? 1) - (b.media ?? 1))[0]
  const valoracion: string[] = []
  if (peor && peor.media != null && porComida.length >= 2) valoracion.push(`La comida con menos ingesta es ${peor.n}${peor.nada ? `: no comió nada ${peor.nada} día${peor.nada > 1 ? 's' : ''}` : ''}${peor.sinApuntar ? `${peor.nada ? ' y' : ':'} sin apuntar ${peor.sinApuntar}` : ''}${!peor.nada && !peor.sinApuntar ? ': es el plato más incompleto de la semana' : ''}.`)
  const cc = plates.map((p) => p.m)
  const nPl = cc.length
  const vegOk = cc.filter((m) => (m.macros?.veg ?? 0) >= 2).length
  const protOkP = cc.filter((m) => (m.macros?.prot ?? 0) >= 2).length
  const fatOk = cc.filter((m) => fatN(m) >= 2).length
  const fatMedia = nPl ? Math.round((cc.reduce((a, m) => a + fatN(m), 0) / nPl) * 10) / 10 : null
  if (nPl) {
    valoracion.push(`En comida y cena (${nPl} platos apuntados): verdura cocida ≈ ½ plato en ${vegOk}, proteína ≈ ⅓ en ${protOkP}, 2 grasas añadidas en ${fatOk} (media ${fatMedia} por plato)${starchDays.length ? `, almidón resistente ${resDays.length} de ${starchDays.length} días con almidón` : ', sin almidón apuntado'}.`)
    const faltan: string[] = []
    if (vegOk / nPl < 0.6) faltan.push('verdura (el aporte es insuficiente)')
    if (fatOk / nPl < 0.6) faltan.push('grasas añadidas')
    if (protOkP / nPl < 0.6) faltan.push('proteína')
    if (!resDays.length) faltan.push('almidón resistente')
    if (faltan.length) valoracion.push(`Lo que no come o come poco: ${faltan.join(', ')}.`)
  }
  const target = (d: string) => (modeOfDay(d) === 'nadir' ? 5 : 3)
  const pocoDias = logged.filter((d) => eaten(d) < target(d) || logOf(d)!.meals.some((m) => m.fraction === 0 || (m.fraction != null && m.fraction < 0.5)))
  const sint = (d: string) => { const l = logOf(d)!; const x: string[] = []; if ((l.symptoms?.nauseas ?? 0) > 0) x.push('náuseas'); if ((l.extra?.vomits?.length ?? 0) > 0) x.push('vómitos'); if ((l.symptoms?.mucositis ?? 0) > 0) x.push('llagas'); if ((l.bristol ?? 0) > 0 && (l.bristol ?? 9) <= 2 || l.stools_n === 0) x.push('estreñimiento'); if ((l.symptoms?.apetito ?? 0) > 0) x.push('menos apetito'); if (HOSPITAL.has(l.location ?? '')) x.push('hospital'); return x }
  const conSint = pocoDias.filter((d) => sint(d).length)
  if (pocoDias.length) valoracion.push(`Días en que comió menos (menos comidas de las de su fase o alguna sin comer): ${pocoDias.map(dayLabel).join(', ')}.${conSint.length ? ` Coinciden con: ${conSint.map((d) => `${dayLabel(d)} (${sint(d).join(', ')})`).join('; ')}.` : ''}`)
  if (lossPct != null && lossPct > 0) {
    const mediaComidas = logged.length ? Math.round((logged.reduce((a, d) => a + eaten(d), 0) / logged.length) * 10) / 10 : null
    const causas: string[] = []
    if (mediaComidas != null) causas.push(`hace ${mediaComidas} comidas al día de media`)
    if (fatMedia != null && fatMedia < 2) causas.push(`las grasas, que son lo que más calorías aporta, se añaden poco (${fatMedia} por plato de media, objetivo 2)`)
    if (snacksPrev && snacksOk < snacksPrev) causas.push(`snacks de grasa ${snacksOk} de ${snacksPrev}`)
    if (peor?.nada) causas.push(`${peor.n} se queda sin hacer algunos días`)
    const vd = logged.filter((d) => (logOf(d)!.extra?.vomits?.length ?? 0) > 0).length
    if (vd) causas.push(`vómitos ${vd} día${vd > 1 ? 's' : ''}`)
    const nd2 = logged.filter((d) => (logOf(d)!.symptoms?.nauseas ?? 0) > 0).length
    if (nd2) causas.push(`náuseas ${nd2} día${nd2 > 1 ? 's' : ''}`)
    valoracion.push(`Pierde peso (−${lossPct} % en la semana) porque en general no llega a las calorías que necesita: ${causas.join('; ')}.`)
  }
  // Nota
  const vals = parts.filter((p) => p.pct != null && !p.label.startsWith('Horario')).map((p) => p.pct!)
  let total = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  let grade = gradeOf(total, logged.length)
  if (lossPct != null && lossPct >= RANGOS.weightLossPct && (grade === 'Bueno' || grade === 'Excelente')) { grade = 'Suficiente'; total = Math.min(total ?? 79, 79) }
  const advice: string[] = []
  const scored = parts.filter((p) => p.pct != null && !p.label.startsWith('Horario')).sort((a, b) => a.pct! - b.pct!)
  if (grade === 'Bueno') advice.push(`Seguir haciendo hincapié en: ${scored[0]?.label.toLowerCase() ?? '—'} (${scored[0]?.pct} %).`)
  else if (grade === 'Excelente') advice.push('Mantener: se está cumpliendo la pauta de la nutricionista.')
  // Acciones para la semana que viene
  const actions: string[] = []
  if (lossPct != null && lossPct >= 1) actions.push('Subir calorías sin subir el volumen: 2 grasas en cada comida y cena (AOVE, ghee, tahine, aguacate), proteína de guisante en purés y yogur, y los snacks de pura grasa (batido con aceite de coco, macadamias).')
  if (peor && peor.media != null && porComida.length >= 2 && peor.media < 0.75) actions.push(`Reforzar ${peor.n}: plato pequeño pero denso (crema de verdura con huevo y AOVE, pescado blando); si no la quiere, ofrecer después un snack de grasa.`)
  if (nPl && vegOk / nPl < 0.6) actions.push('Más verdura cocida: medio plato de verdura de fibra soluble (calabaza, calabacín, zanahoria, puerro, judía verde, setas), también en cremas.')
  if (nPl && fatOk / nPl < 0.6) actions.push('Dos grasas añadidas en cada comida y cena (por ejemplo, AOVE + tahine, o ghee + semillas).')
  if (!resDays.length || (starchDays.length && resDays.length / starchDays.length < 0.6)) actions.push('Introducir almidón resistente: quinoa, patata o boniato cocidos y enfriados en la nevera (se pueden templar antes de comer).')
  if (logged.length && protOk / logged.length < 0.8) actions.push('Proteína en al menos 3 comidas al día (huevo, pescado, pollo, paté de sardinas, proteína de guisante).')
  if (snacksPrev && snacksOk / snacksPrev < 0.6) actions.push('En nadir, los 2 snacks de pura grasa cada día.')
  if (conSint.some((d) => /náuseas|vómitos/.test(sint(d).join()))) actions.push('Los días con náuseas o vómitos come peor: dar el rescate antes de comer y ofrecer tomas pequeñas y frecuentes.')
  const sinVariar = ind.filter((x) => x.label.startsWith('Desincronización') && x.value.startsWith('No varía')).map((x) => x.label.replace('Desincronización · ', ''))
  if (sinVariar.length) actions.push(`Variar la hora ${sinVariar.map((x, i) => (x === 'desayuno' ? (i ? 'del desayuno' : 'del desayuno') : `de la ${x}`)).join(', ').replace(/, ([^,]*)$/, ' y $1')}: al menos 1 hora de diferencia entre días.`)
  return {
    key: 'nutricion', title: 'Nutrición', ico: '🥣', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin datos' : `${total} %${lossPct != null && lossPct > 0 ? ` · pierde peso (−${lossPct} %)` : ''}`, indicators: ind, advice, parts, actions,
    sections: valoracion.length ? [{ title: 'Valoración de la semana', lines: valoracion }] : undefined,
    complications: grade === 'Insuficiente' || grade === 'Suficiente' ? complications : undefined,
  }
}

// ---------- 6. Hidratación ----------
/** Supuestos del balance (aproximado): orina = ml medidos o nº de micciones × 150 ml; vómito ≈ 100 ml; deposición líquida ≈ 100 ml.
 *  No cuenta sudor ni respiración. Los días de ingreso no se valoran (llevan sueros). */
export const BALANCE = { mlPorMiccion: 150, mlPorVomito: 100, mlPorDeposicionLiquida: 100, justo: 300 }
function hidratacion(days: string[], logOf: (d: string) => DailyLog | undefined, ctx: (d: string) => CycleContext, modeOfDay: (d: string) => 'quimio' | 'nadir', data: WeeklyData): Bloque {
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
  const hardest = [...drinks].sort((a, b) => b.zero - a.zero || a.ratio - b.ratio)[0]
  const clearHardest = hardest.zero > 0 || hardest.ratio < 0.9
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
  // Balance de entradas y salidas (aproximado), sin los días de ingreso.
  const bal = logged.filter((d) => !HOSPITAL.has(logOf(d)!.location ?? '')).map((d) => {
    const l = logOf(d)!
    const entra = totalFluids(l)
    const orina = l.urine_ml ?? (l.urine_count != null ? l.urine_count * BALANCE.mlPorMiccion : null)
    const vom = (l.extra?.vomits?.length ?? 0) * BALANCE.mlPorVomito
    const dep = (l.bristol ?? 0) >= 6 ? (l.stools_n ?? 1) * BALANCE.mlPorDeposicionLiquida : 0
    if (entra == null || orina == null) return { d, entra, sale: null as number | null, dif: null as number | null, vom, orina }
    const sale = orina + vom + dep
    return { d, entra, sale, dif: entra - sale, vom, orina }
  })
  const balOk = bal.filter((b) => b.dif != null)
  const neg = balOk.filter((b) => b.dif! < 0)
  const justo = balOk.filter((b) => b.dif! >= 0 && b.dif! < BALANCE.justo)
  const balLight: Light = !balOk.length ? 'gris' : neg.length >= 2 ? 'rojo' : neg.length || justo.length >= 2 ? 'amarillo' : 'verde'
  const mediaE = balOk.length ? Math.round(balOk.reduce((a, b) => a + b.entra!, 0) / balOk.length) : null
  const mediaS = balOk.length ? Math.round(balOk.reduce((a, b) => a + b.sale!, 0) / balOk.length) : null
  const balTexto = !balOk.length
    ? 'Sin datos suficientes (hace falta apuntar líquidos y micciones o ml de orina el mismo día)'
    : `${neg.length ? `Negativo (sale más de lo que entra) ${neg.length} día${neg.length > 1 ? 's' : ''}: ${neg.map((b) => dayLabel(b.d)).join(', ')}. ` : ''}${justo.length ? `Justo ${justo.length} día${justo.length > 1 ? 's' : ''}. ` : ''}${!neg.length && !justo.length ? 'Balanceado todos los días valorados. ' : ''}Media: entran ${mediaE} ml y salen unos ${mediaS} ml al día.`
  const ind: Indicador[] = [
    { label: 'Líquidos totales', value: ml.length ? `Media ${Math.round(ml.reduce((a, b) => a + b, 0) / ml.length)} ml/día · llega al objetivo ${reach.length} de ${withF.length} días` : 'Sin datos', light: GRADE_LIGHT[grade], note: 'Objetivo: 1.500 ml en quimio y 1.200 ml en nadir (pendiente de la nutricionista)' },
    { label: 'Agua', value: `${Math.round(drinks[0].avg)} ml/día · ${drinks[0].zero} días sin tomar` },
    { label: 'Agua de mar', value: `${Math.round(drinks[1].avg)} ml/día (objetivo ${SEAWATER_TARGET_ML}) · ${drinks[1].zero} días sin tomar`, light: drinks[1].avg >= SEAWATER_TARGET_ML ? 'verde' : 'amarillo' },
    { label: 'Caldo', value: `${Math.round(drinks[2].avg)} ml/día · ${drinks[2].zero} días sin tomar` },
    { label: 'Manzanilla y jengibre', value: inf ? `${inf} medias tazas/día` : 'Nada apuntado' },
    { label: 'Color de la orina', value: cAvg == null ? 'Sin datos' : `Media ${cAvg} (${URINE_LABELS[Math.round(cAvg) - 1]?.toLowerCase()}) · peor ${cMax}`, light: cMax == null ? 'gris' : cMax >= 5 ? 'rojo' : cMax >= 4 ? 'amarillo' : 'verde' },
    { label: 'Micciones', value: `${vAvg != null ? `Media ${vAvg}/día` : 'Sin número apuntado'}${usual != null ? ` (lo habitual: ${usual})` : ''}${menos.length ? ` · «menos de lo habitual»: ${menos.map(dayLabel).join(', ')}` : ''}`, light: fewer ? 'amarillo' : 'verde', note: usual == null ? 'Pon lo habitual en Pilares → Ajustes' : undefined },
    ...(mtxDays.length ? [{ label: 'pH de orina en metotrexato', value: `${pct(phOk, mtxDays.length)} % con pH 7 o más`, light: (phOk === mtxDays.length ? 'verde' : 'rojo') as Light }] : []),
    { label: 'Balance de entradas y salidas', value: balTexto, light: balLight, note: `Aproximado: orina = ml medidos o nº de micciones × ${BALANCE.mlPorMiccion} ml; cada vómito ≈ ${BALANCE.mlPorVomito} ml; no cuenta sudor ni respiración, así que conviene que entre algo más de lo que sale. Sin los días de ingreso (sueros).` },
  ]
  const advice: string[] = []
  const actions: string[] = []
  if (grade === 'Insuficiente' || grade === 'Suficiente') {
    advice.push(clearHardest
      ? `La bebida que más le cuesta: ${hardest.label.toLowerCase()} (${hardest.zero} días sin tomar, ${Math.round(hardest.avg)} ml/día de media${hardest.ratio < 0.9 ? `, ${Math.round((1 - hardest.ratio) * 100)} % menos que la semana anterior` : ''}).`
      : 'Agua, agua de mar y caldo se toman todos los días: lo que falta es cantidad total.')
    actions.push(clearHardest ? `Ofrecer ${hardest.label.toLowerCase()} a sorbos a lo largo del día.` : 'Subir la cantidad total, a sorbos a lo largo del día.')
    if (drinks[2] !== hardest && drinks[2].zero > 0) actions.push('Ofrecer caldo a sorbos a lo largo del día (también cuenta como líquido y como base de los platos).')
    if (drinks[1].avg < SEAWATER_TARGET_ML && drinks[1] !== hardest) actions.push(`Agua de mar: llegar a ${SEAWATER_TARGET_ML} ml al día en chupitos.`)
  } else if (grade === 'Bueno' || grade === 'Excelente') advice.push(clearHardest ? `Seguir insistiendo en: ${hardest.label.toLowerCase()}, que es la que más le cuesta.` : 'Mantener: toma las tres bebidas todos los días.')
  if (neg.length) actions.push(`Balance negativo ${neg.length} día${neg.length > 1 ? 's' : ''}: reponer lo que pierde (más líquido los días de vómitos) y vigilar orina oscura o escasa.`)
  if (fewer) advice.push('Orina menos de lo habitual: vigilar la hidratación.')
  return {
    key: 'hidratacion', title: 'Hidratación', ico: '💧', grade, pct: total, light: GRADE_LIGHT[grade],
    summary: total == null ? 'Sin datos' : `${reach.length} de ${withF.length} días en el objetivo${neg.length ? ` · balance negativo ${neg.length} día${neg.length > 1 ? 's' : ''}` : ''}`, indicators: ind, advice, actions,
    table: balOk.length ? { head: ['Día', 'Entra (ml)', 'Orina (ml aprox.)', 'Vómitos (ml aprox.)', 'Balance'], rows: bal.map((b) => [dayLabel(b.d), b.entra != null ? String(b.entra) : '—', b.orina != null ? String(b.orina) : '—', b.vom ? String(b.vom) : '—', b.dif == null ? 'sin datos' : `${b.dif > 0 ? '+' : ''}${b.dif}${b.dif < 0 ? ' ⚠️' : ''}`]) } : undefined,
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
  const falls = days.map((d) => ({ d, f: logOf(d)?.extra?.functional?.falls })).filter((x) => x.f && x.f.trim() && !/^(no|ninguna?|nada|-+|0|sin caídas?|no hay)\.?$/i.test(x.f.trim()))
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
    actions: [
      ...(grade === 'Insuficiente' || grade === 'Suficiente' ? ['Algo de movimiento cada día, aunque sea corto: paseo, juego de pie o fisio. En el hospital y en los días 5–14 basta con moverse un poco.'] : []),
      ...(mvPct != null && mvPct < 60 ? [`Moverse unos minutos después de cada comida (${mv} de ${days.length * 3} esta semana).`] : []),
      ...(worse ? ['La capacidad funcional ha empeorado: comentarlo con el entrenador o la fisio.'] : []),
    ],
    parts: [{ label: 'Días con actividad adecuada', pct: total, detail: '' }, { label: 'Movimiento después de comer', pct: mvPct, detail: '' }],
  }
}

// ---------- 8. Biohacking ----------
const SYNC_ACCION: Record<string, string> = {
  daylight_morning: 'Salir o ponerse junto a la ventana 10–15 minutos por la mañana.',
  ir_morning: 'Luz roja por la mañana, a la misma hora.',
  daylight_afternoon: 'Un rato de luz natural por la tarde.',
  sun_exposure: 'Sol con cuidado unos minutos, cuando se pueda.',
  ir_night: 'Luz roja por la noche en lugar de la luz blanca.',
  glasses: 'Gafas de luz azul desde la cena y sin pantallas antes de dormir.',
}
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
    { label: 'Siesta', value: naps.length ? `${naps.length} día${naps.length > 1 ? 's' : ''} · ${napAvg} min de media${longNaps.length ? ` · más de 90 min: ${longNaps.map(dayLabel).join(', ')}` : ''}` : 'Ningún día' },
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
    actions: [
      ...sync.filter((x) => x.p != null && x.p < 60).map((x) => `${x.s.label}: ${x.p} % de los días. ${SYNC_ACCION[x.s.key] ?? 'Hacerlo a diario.'}`),
      ...(gaps.length && gapOk < gaps.length ? [`Dejar 2 horas entre la cena y dormir (${gapOk} de ${gaps.length} días): cenar antes o acostarse algo más tarde.`] : []),
      ...(hs.length && avg(hs)! < RANGOS.sleepH[0] ? ['Adelantar la hora de acostarse para llegar a 9–12 horas de sueño.'] : []),
      ...(longNaps.length ? ['Siestas de menos de 90 minutos y no a última hora de la tarde.'] : []),
      ...(cause && /dolor|náusea/i.test(cause) ? [`Se despierta por ${cause.toLowerCase()}: comentarlo con oncología.`] : []),
    ],
    parts: [
      ...sync.filter((x) => x.p != null).map((x) => ({ label: x.s.label, pct: x.p, detail: '' })),
      ...(gaps.length ? [{ label: 'Dormir 2 h después de cenar', pct: pct(gapOk, gaps.length), detail: '' }] : []),
    ],
  }
}

/** Días de la semana (lunes) de una fecha cualquiera. */
export { weekStart } from './dates'
