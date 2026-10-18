import type { DailyLog, Meal, MealMacros, WeekMode } from '../store/types'
import type { CycleContext } from './cycle'
import { CUP_ML, FLUID_TARGET, MEAL_SLOTS, MEAL_SLOTS_BY_MODE, mealsTargetFor, pautaNueva, TOMAS } from './catalogs'

export function eatingWindow(meals: Meal[]) {
  const times = meals.map((m) => m.time).filter((t): t is string => !!t).sort()
  if (times.length < 2) return null
  return { first: times[0], last: times[times.length - 1], hours: hoursDiff(times[0], times[times.length - 1]) }
}
function hoursDiff(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return Math.round(((bh * 60 + bm - (ah * 60 + am)) / 60) * 10) / 10
}
/** ¿En esta comida comió algo? Si está marcada "Nada" (o todo a cero) no cuenta
 *  para el ayuno: si no cenó, la última ingesta es la merienda o la comida. */
/** Hora de empezar y de terminar de una toma (si solo hay una, vale para las dos). */
export const iniDe = (m: Meal) => m.time || m.end || null
export const finDe = (m: Meal) => m.end || m.time || null
function comio(m: Meal) {
  if (!iniDe(m)) return false
  if (m.fraction === 0) return false
  if (m.fraction != null && m.fraction > 0) return true
  const mc = m.macros
  if (mc && (mc.veg || mc.prot || mc.starch || mc.fat)) return true
  if (m.carb || m.texture || m.note || m.amount) return true
  // Solo hay hora: se da por bueno.
  return m.fraction == null && !mc
}
/** Comidas que cuentan para el ayuno, ordenadas por hora. */
function ingestas(log: DailyLog | undefined) {
  return (log?.meals ?? []).filter(comio).sort((x, y) => (iniDe(x) ?? '').localeCompare(iniDe(y) ?? ''))
}
/** Ayuno nocturno con el detalle de qué comidas se han usado. */
export function overnightFastDetail(today: DailyLog | undefined, yesterday: DailyLog | undefined) {
  // Desde la que termina más tarde ayer (con la hora de fin, si la hay) hasta la primera de hoy.
  const last = ingestas(yesterday).sort((x, y) => (finDe(x) ?? '').localeCompare(finDe(y) ?? '')).pop()
  const first = ingestas(today)[0]
  const lt = last && finDe(last), ft = first && iniDe(first)
  if (!lt || !ft) return null
  const hours = Math.round((24 - hoursDiff('00:00', lt) + hoursDiff('00:00', ft)) * 10) / 10
  return { hours, last: { ...last!, time: lt }, first: { ...first!, time: ft } }
}
/** Ayuno nocturno: desde la última ingesta real de ayer hasta la primera de hoy. */
export function overnightFast(today: DailyLog | undefined, yesterday: DailyLog | undefined) {
  return overnightFastDetail(today, yesterday)?.hours ?? null
}
/** Horas de ayuno del día: las tecleadas a mano tienen prioridad; si no, se calculan. */
export function fastingHours(today: DailyLog | undefined, yesterday: DailyLog | undefined) {
  if (today?.extra?.fasting_h != null) return today.extra.fasting_h
  return overnightFast(today, yesterday)
}
const aMin = (h?: string | null) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const aHora = (min: number) => { const x = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0') }
export { aMin, aHora }
const nombreToma = (slot: string) => TOMAS.find((t) => t.key === slot)?.label ?? MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot

export interface Nocturno { desdeNombre: string; desdeHora: string; finNombre: string | null; finHora: string | null; minutos: number; enMarcha: boolean }
/** Reloj del ayuno de la noche (como New Version): desde la última comida con hora de ayer hasta la primera toma
 *  de hoy con hora escrita. Mientras hoy no se escriba ninguna hora, sigue en marcha hasta `ahoraMin`. */
export function ayunoNocturno(yesterday: DailyLog | undefined, today: DailyLog | undefined, ahoraMin: number): Nocturno | null {
  const last = ingestas(yesterday).sort((x, y) => (finDe(x) ?? '').localeCompare(finDe(y) ?? '')).pop()
  const desde = last ? aMin(finDe(last)) : null
  if (!last || desde == null) return null
  const first = ingestas(today)[0]
  const ini = first ? aMin(iniDe(first)) : null
  const hasta = ini ?? ahoraMin
  return { desdeNombre: nombreToma(last.slot), desdeHora: aHora(desde), finNombre: first && ini != null ? nombreToma(first.slot) : null, finHora: ini != null ? aHora(ini) : null, minutos: hasta + 1440 - desde, enMarcha: ini == null }
}
export interface Ultima { nombre: string; hora: string; ayer: boolean; minutos: number }
/** La última comida con hora: la que termina más tarde hoy sin pasar de ahora; si hoy no hay ninguna, la de ayer. */
export function ultimaComida(yesterday: DailyLog | undefined, today: DailyLog | undefined, ahoraMin: number): Ultima | null {
  const mejor = (log: DailyLog | undefined, tope: number) => {
    let r: { nombre: string; fin: number } | null = null
    for (const m of ingestas(log)) { const f = aMin(finDe(m)); if (f != null && f <= tope && (!r || f >= r.fin)) r = { nombre: nombreToma(m.slot), fin: f } }
    return r
  }
  const h = mejor(today, ahoraMin)
  if (h) return { nombre: h.nombre, hora: aHora(h.fin), ayer: false, minutos: ahoraMin - h.fin }
  const a = mejor(yesterday, 1440)
  return a ? { nombre: a.nombre, hora: aHora(a.fin), ayer: true, minutos: ahoraMin + 1440 - a.fin } : null
}

export function breakfastTime(log: DailyLog | undefined) {
  return log?.meals.find((m) => m.slot === 'desayuno')?.time ?? null
}
export function carbProfile(meals: Meal[]): 'sin datos' | 'cetogénico (orientativo)' | 'low carb (orientativo)' | 'moderado' | 'alto' {
  const w: Record<string, number> = { sin: 0, baja: 1, media: 2, alta: 3 }
  // Desde la 0.16.0 la cantidad de hidratos es `macros.starch` (0-3); los registros antiguos usan `carb`.
  const fromStarch = ['sin', 'baja', 'media', 'alta'] as const
  const vals = meals.map((m) => m.carb ?? (m.macros?.starch != null ? fromStarch[m.macros.starch] : undefined)).filter((c): c is NonNullable<typeof c> => !!c)
  if (!vals.length) return 'sin datos'
  const avg = vals.reduce((a, c) => a + w[c], 0) / vals.length
  if (avg <= 0.5) return 'cetogénico (orientativo)'
  if (avg <= 1.2) return 'low carb (orientativo)'
  if (avg <= 2) return 'moderado'
  return 'alto'
}
export function meanIntake(meals: Meal[]) {
  const fr = meals.map((m) => m.fraction).filter((f): f is NonNullable<typeof f> => f != null)
  return fr.length ? (fr as number[]).reduce((a, b) => a + b, 0) / fr.length : null
}

/** Modo de la semana: manual si se ha elegido; si no, "quimio" en ciclo o D0-D6 y "nadir" desde D7. */
/** Modo de la semana (comidas de quimio o de nadir). Decisión 28/09/2026: sigue la misma regla que las pautas
 *  de alimentación y el calendario: **semana nadir desde el 8.º día del cisplatino** hasta la siguiente quimio;
 *  semana de metotrexato y de cisplatino = semana de quimio. Se puede forzar a mano. Sin sesiones registradas
 *  alrededor de ese día, se deduce del ciclo como antes. */
export function weekMode(log: DailyLog | undefined, ctx: CycleContext): WeekMode {
  if (log?.extra?.mode) return log.extra.mode
  if (ctx.fase) return ctx.fase === 'nadir' ? 'nadir' : 'quimio'
  if (!ctx.cycle || ctx.day == null) return 'nadir'
  if (ctx.inCycle || (ctx.day >= 0 && ctx.day < 7)) return 'quimio'
  return 'nadir'
}
export function slotsForMode(mode: WeekMode) {
  // En el orden del día que marca cada modo (el snack de media mañana va entre el desayuno y la comida).
  return MEAL_SLOTS_BY_MODE[mode].map((k) => MEAL_SLOTS.find((s) => s.key === k)!).filter(Boolean)
}
/** Nº de grasas añadidas de una comida (registros antiguos: sí = 1). */
export function fatCount(m: MealMacros | undefined): number | null {
  if (!m) return null
  if (m.fat_n != null) return m.fat_n
  if (m.fat == null) return null
  return m.fat ? 1 : 0
}
export function isFatSlot(slot: string) {
  return !!MEAL_SLOTS.find((s) => s.key === slot)?.fat
}

export type Light = 'verde' | 'amarillo' | 'rojo'
export interface MealCheck { level: Light; missing: string[] }
/** Semáforo de una comida frente al plato de la nutricionista:
 *  ½ verdura cocida · ⅓ proteína · ¼ almidón resistente · grasa "invisible" añadida.
 *  En días de cisplatino se reduce hidrato y grasa. Snacks de grasa: solo se pide grasa. */
export function mealTraffic(meal: Meal, opts: { cisplatin?: boolean; date?: string | null } = {}): MealCheck | null {
  const m = meal.macros
  const eaten = meal.fraction
  if (!m && eaten == null) return null
  if (!m) return eaten != null && eaten < 0.5 ? { level: 'rojo', missing: ['comió menos de la mitad', 'plato sin valorar'] } : null
  const missing: string[] = []
  if (pautaNueva(opts.date)) {
    // Pauta del 18/10/2026: ½ hidratos · ⅓ verdura · el resto proteína. Comer más hidrato no lleva aviso.
    // Las grasas añadidas solo cuentan si se han marcado (van en «Más detalles»).
    if (isFatSlot(meal.slot)) { if (m.fat === false) missing.push('grasa') }
    else {
      if ((m.starch ?? 0) < 2) missing.push(m.starch ? 'más hidratos' : 'hidratos')
      if ((m.veg ?? 0) < 2) missing.push(m.veg ? 'más verdura' : 'verdura')
      if ((m.prot ?? 0) < 2) missing.push(m.prot ? 'más proteína' : 'proteína')
      if (fatCount(m) === 0) missing.push('grasa añadida')
    }
  } else if (isFatSlot(meal.slot)) {
    if (!m?.fat) missing.push('grasa')
  } else {
    if ((m.veg ?? 0) < 2) missing.push(m.veg ? 'más verdura cocida' : 'verdura cocida')
    if ((m.prot ?? 0) < 2) missing.push(m.prot ? 'más proteína' : 'proteína')
    const nf = fatCount(m) ?? 0
    // Dos grasas añadidas por plato; en cisplatino se pide menos grasa y basta con una.
    const fatGoal = opts.cisplatin ? 1 : 2
    if (nf === 0) missing.push('grasa añadida')
    else if (nf < fatGoal) missing.push('otra grasa añadida (objetivo 2)')
    if (opts.cisplatin) {
      if ((m.starch ?? 0) >= 2) missing.push('menos hidratos (día de cisplatino)')
    } else if ((m.starch ?? 0) === 0) missing.push('algo de hidratos')
    else if ((m.starch ?? 0) === 3) missing.push('demasiados hidratos')
  }
  if (eaten != null && eaten < 0.5) missing.push('comió menos de la mitad')
  const level: Light = missing.length === 0 ? 'verde' : missing.length === 1 && (eaten ?? 1) >= 0.5 ? 'amarillo' : 'rojo'
  return { level, missing }
}

export interface DayNutrition {
  level: Light
  reasons: string[]
  meals: number
  target: number
  fatSnacks: number
  fatTarget: number
  greens: number
  fluids: number | null
  fluidTarget: number
}
/** Semáforo del día completo: nº de comidas, snacks de grasa, calidad de los platos y líquidos. */
export function dayNutrition(log: DailyLog | undefined, mode: WeekMode, opts: { cisplatin?: boolean } = {}): DayNutrition {
  const t = mealsTargetFor(mode, log?.date)
  const fluidTarget = FLUID_TARGET[mode]
  const meals = (log?.meals ?? []).filter((m) => m.fraction != null || m.macros || m.time || m.end || m.note || m.amount)
  const eatenMeals = meals.filter((m) => (m.fraction ?? 1) > 0)
  const fatSnacks = eatenMeals.filter((m) => isFatSlot(m.slot) && (m.macros?.fat ?? true)).length
  const checks = meals.map((m) => mealTraffic(m, { ...opts, date: log?.date })).filter((c): c is MealCheck => !!c)
  const greens = checks.filter((c) => c.level === 'verde').length
  const reds = checks.filter((c) => c.level === 'rojo').length
  const fluids = totalFluids(log)
  const reasons: string[] = []
  if (!log || meals.length === 0) return { level: 'rojo', reasons: ['Sin comidas registradas'], meals: 0, target: t.min, fatSnacks: 0, fatTarget: t.fatSnacks, greens: 0, fluids, fluidTarget }
  if (eatenMeals.length < t.min) reasons.push(`${eatenMeals.length} de ${t.min} comidas`)
  if (fatSnacks < t.fatSnacks) reasons.push(`${fatSnacks} de ${t.fatSnacks} snacks de grasa`)
  if (checks.length && greens < Math.ceil(checks.length / 2)) reasons.push('menos de la mitad de los platos en verde')
  if (reds >= 2) reasons.push(`${reds} platos en rojo`)
  if (fluids != null && fluids < fluidTarget * 0.7) reasons.push(`líquidos ${fluids} ml (objetivo ${fluidTarget})`)
  const level: Light = reasons.length === 0 ? 'verde' : reasons.length === 1 ? 'amarillo' : 'rojo'
  return { level, reasons, meals: eatenMeals.length, target: t.min, fatSnacks, fatTarget: t.fatSnacks, greens, fluids, fluidTarget }
}
/** Total de líquidos: si se tecleó el total se usa; si no, suma agua + agua de mar + caldo + infusiones. */
export function totalFluids(log: DailyLog | undefined): number | null {
  if (!log) return null
  if (log.fluids_total_ml != null) return log.fluids_total_ml
  const parts = [log.water_ml ?? 0, log.seawater_ml ?? 0, (log.broth_cups ?? 0) * CUP_ML, (log.extra?.infusion_cups ?? 0) * CUP_ML]
  const sum = parts.reduce((a, b) => a + b, 0)
  return sum > 0 ? sum : null
}
