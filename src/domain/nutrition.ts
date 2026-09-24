import type { DailyLog, Meal, WeekMode } from '../store/types'
import type { CycleContext } from './cycle'
import { CUP_ML, FLUID_TARGET, MEAL_SLOTS, MEAL_SLOTS_BY_MODE, MEALS_TARGET } from './catalogs'

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
function comio(m: Meal) {
  if (!m.time) return false
  if (m.fraction === 0) return false
  if (m.fraction != null && m.fraction > 0) return true
  const mc = m.macros
  if (mc && (mc.veg || mc.prot || mc.starch || mc.fat)) return true
  if (m.carb || m.texture || m.note) return true
  // Solo hay hora: se da por bueno.
  return m.fraction == null && !mc
}
/** Comidas que cuentan para el ayuno, ordenadas por hora. */
function ingestas(log: DailyLog | undefined) {
  return (log?.meals ?? []).filter(comio).sort((x, y) => (x.time ?? '').localeCompare(y.time ?? ''))
}
/** Ayuno nocturno con el detalle de qué comidas se han usado. */
export function overnightFastDetail(today: DailyLog | undefined, yesterday: DailyLog | undefined) {
  const last = ingestas(yesterday).pop()
  const first = ingestas(today)[0]
  if (!last?.time || !first?.time) return null
  const hours = Math.round((24 - hoursDiff('00:00', last.time) + hoursDiff('00:00', first.time)) * 10) / 10
  return { hours, last, first }
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
export function breakfastTime(log: DailyLog | undefined) {
  return log?.meals.find((m) => m.slot === 'desayuno')?.time ?? null
}
export function carbProfile(meals: Meal[]): 'sin datos' | 'cetogénico (orientativo)' | 'low carb (orientativo)' | 'moderado' | 'alto' {
  const w: Record<string, number> = { sin: 0, baja: 1, media: 2, alta: 3 }
  const vals = meals.map((m) => m.carb).filter((c): c is NonNullable<typeof c> => !!c)
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
export function weekMode(log: DailyLog | undefined, ctx: CycleContext): WeekMode {
  if (log?.extra?.mode) return log.extra.mode
  if (!ctx.cycle || ctx.day == null) return 'nadir'
  if (ctx.inCycle || (ctx.day >= 0 && ctx.day < 7)) return 'quimio'
  return 'nadir'
}
export function slotsForMode(mode: WeekMode) {
  return MEAL_SLOTS.filter((s) => MEAL_SLOTS_BY_MODE[mode].includes(s.key))
}
export function isFatSlot(slot: string) {
  return !!MEAL_SLOTS.find((s) => s.key === slot)?.fat
}

export type Light = 'verde' | 'amarillo' | 'rojo'
export interface MealCheck { level: Light; missing: string[] }
/** Semáforo de una comida frente al plato de la nutricionista:
 *  ½ verdura cocida · ⅓ proteína · ¼ almidón resistente · grasa "invisible" añadida.
 *  En días de cisplatino se reduce hidrato y grasa. Snacks de grasa: solo se pide grasa. */
export function mealTraffic(meal: Meal, opts: { cisplatin?: boolean } = {}): MealCheck | null {
  const m = meal.macros
  const eaten = meal.fraction
  if (!m && eaten == null) return null
  if (!m) return eaten != null && eaten < 0.5 ? { level: 'rojo', missing: ['comió menos de la mitad', 'plato sin valorar'] } : null
  const missing: string[] = []
  if (isFatSlot(meal.slot)) {
    if (!m?.fat) missing.push('grasa')
  } else {
    if ((m.veg ?? 0) < 2) missing.push(m.veg ? 'más verdura cocida' : 'verdura cocida')
    if ((m.prot ?? 0) < 2) missing.push(m.prot ? 'más proteína' : 'proteína')
    if (!m.fat) missing.push('grasa añadida')
    if (opts.cisplatin) {
      if ((m.starch ?? 0) >= 2) missing.push('menos almidón (día de cisplatino)')
    } else if ((m.starch ?? 0) === 0) missing.push('algo de almidón resistente')
    else if ((m.starch ?? 0) === 3) missing.push('demasiado almidón')
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
  const t = MEALS_TARGET[mode]
  const fluidTarget = FLUID_TARGET[mode]
  const meals = (log?.meals ?? []).filter((m) => m.fraction != null || m.macros || m.time)
  const eatenMeals = meals.filter((m) => (m.fraction ?? 1) > 0)
  const fatSnacks = eatenMeals.filter((m) => isFatSlot(m.slot) && (m.macros?.fat ?? true)).length
  const checks = meals.map((m) => mealTraffic(m, opts)).filter((c): c is MealCheck => !!c)
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
