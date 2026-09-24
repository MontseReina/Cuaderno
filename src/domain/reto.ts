import type { Challenge, Cycle, DailyLog, ExerciseSession, Intake, Product } from '../store/types'
import { cycleContext } from './cycle'
import { dayNutrition, totalFluids, weekMode } from './nutrition'
import { medicationProgress, trafficWindow } from './medication'
import { dayCompleteness } from './completeness'
import { FLUID_TARGET } from './catalogs'
import { addDays, todayStr, weekStart } from './dates'

/** Reto de la semana: juego de puntos para el niño.
 *  Reglas: los puntos se calculan solos con lo que ya se apunta; solo suben, nunca bajan;
 *  los días de hospital tienen un mínimo garantizado. Nada de esto se guarda: se recalcula. */

export const DAY_MAX = 100
export const GOAL_DEFAULT = 500
export const SHIELD_DEFAULT = 60

export type CatKey = 'comer' | 'beber' | 'moverse' | 'medicinas' | 'dormir' | 'estoy'
export const CATS: { key: CatKey; emoji: string; label: string; max: number; rule: string }[] = [
  { key: 'comer', emoji: '🥣', label: 'Comer', max: 30, rule: 'Cada comida suma. Con medio plato ya cuenta. En semana de quimio son 3 comidas (10 puntos cada una); en semana nadir, 6 pequeñas (5 cada una).' },
  { key: 'beber', emoji: '💧', label: 'Beber', max: 25, rule: 'Cuanto más te acerques a tu objetivo de líquidos, más puntos. Agua, caldo, infusiones y agua de mar cuentan.' },
  { key: 'moverse', emoji: '🏃', label: 'Moverse', max: 20, rule: '10 puntos por moverte un poco (un paseo, unos pasos). 20 si haces la sesión completa o 20 minutos.' },
  { key: 'medicinas', emoji: '💊', label: 'Medicinas', max: 10, rule: 'Todas las tomas del día. Si son 5 y te tomas 4, ganas 8.' },
  { key: 'dormir', emoji: '🌙', label: 'Dormir', max: 10, rule: 'Apuntar a qué hora te has dormido y despertado, y la luz de la mañana.' },
  { key: 'estoy', emoji: '📝', label: 'Cómo estoy', max: 5, rule: 'Tener el diario del día rellenado (dónde estás, temperatura, pipí, caca, dolor, energía, ánimo).' },
]

/** Las seis formas de Huma. Se desbloquean a partes iguales de la meta (con 500: cada 100 puntos). */
export const FORMS: { key: string; name: string }[] = [
  { key: 'huevo', name: 'Huevo' },
  { key: 'cria', name: 'Cría' },
  { key: 'plumon', name: 'Plumón' },
  { key: 'alado', name: 'Alado' },
  { key: 'llama', name: 'Llama' },
  { key: 'fenix', name: 'Fénix' },
]
export const formAt = (i: number, goal: number) => Math.round((goal * i) / (FORMS.length - 1))
/** Nivel actual (0..5) según los puntos de la semana. */
export function levelFor(points: number, goal: number) {
  let lvl = 0
  for (let i = 1; i < FORMS.length; i++) if (points >= formAt(i, goal)) lvl = i
  return lvl
}

export interface CatPoints { key: CatKey; emoji: string; label: string; pts: number; max: number; detail: string }
export interface DayPoints {
  date: string
  cats: CatPoints[]
  /** Puntos ganados de verdad. */
  base: number
  /** Día de hospital (ingreso, hospital de día, urgencias o infusión): mínimo garantizado. */
  shield: boolean
  total: number
}

export interface RetoInputs {
  logs: DailyLog[]
  cycles: Cycle[]
  products: Product[]
  intakes: Intake[]
  sessions: ExerciseSession[]
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)))

export function dayPoints(date: string, inp: RetoInputs, shieldMin = SHIELD_DEFAULT): DayPoints {
  const log = inp.logs.find((l) => l.date === date)
  const ctx = cycleContext(inp.cycles, date)
  const mode = weekMode(log, ctx)
  const cats: CatPoints[] = []

  // 🥣 Comer: proporcional a las comidas del modo (3 en quimio, 6 en nadir); medio plato ya cuenta.
  const nut = dayNutrition(log, mode)
  const comer = clamp((30 * nut.meals) / nut.target, 30)
  cats.push({ key: 'comer', emoji: '🥣', label: 'Comer', pts: comer, max: 30, detail: `${nut.meals} de ${nut.target} comidas` })

  // 💧 Beber: proporcional al objetivo de líquidos del modo.
  const fluids = totalFluids(log) ?? 0
  const ftarget = FLUID_TARGET[mode]
  const beber = clamp((25 * fluids) / ftarget, 25)
  cats.push({ key: 'beber', emoji: '💧', label: 'Beber', pts: beber, max: 25, detail: fluids ? `${fluids} de ${ftarget} ml` : 'todavía nada' })

  // 🏃 Moverse: 10 por algo de movimiento, 20 por sesión completa o ≥ 20 min.
  const ses = inp.sessions.filter((s) => s.date === date)
  const minutes = (log?.activity_min ?? 0) + ses.reduce((a, s) => a + (s.minutes ?? 0), 0)
  const fullSession = ses.some((s) => s.exercises?.length) || minutes >= 20
  const some = minutes > 0 || (log?.steps ?? 0) > 0 || Object.values(log?.activity ?? {}).some(Boolean) || ses.length > 0
  const moverse = fullSession ? 20 : some ? 10 : 0
  cats.push({ key: 'moverse', emoji: '🏃', label: 'Moverse', pts: moverse, max: 20, detail: fullSession ? (minutes ? `${minutes} min` : 'sesión hecha') : some ? 'un poco de movimiento' : 'todavía nada' })

  // 💊 Medicinas: tomas hechas / previstas.
  const med = medicationProgress(inp.products, inp.intakes, inp.cycles, date)
  const medicinas = med.planned === 0 ? 10 : clamp((10 * med.taken) / med.planned, 10)
  cats.push({ key: 'medicinas', emoji: '💊', label: 'Medicinas', pts: medicinas, max: 10, detail: med.planned === 0 ? 'hoy no tocan' : `${med.taken} de ${med.planned} tomas` })

  // 🌙 Dormir: el biohacking del día rellenado.
  const dormir = log && (log.sleep_start || log.sleep_end || log.wakeups != null
    || [log.ir_morning, log.ir_night, log.glasses, log.daylight_morning, log.daylight_afternoon, log.sun_exposure].some(Boolean)
    || Object.keys(log.extra?.sync ?? {}).length > 0) ? 10 : 0
  cats.push({ key: 'dormir', emoji: '🌙', label: 'Dormir', pts: dormir, max: 10, detail: dormir ? 'apuntado' : 'se apunta por la noche' })

  // 📝 Cómo estoy: el diario con al menos la mitad.
  const comp = dayCompleteness(log, date, med)
  const diario = comp.items.filter((i) => i.diario)
  const doneDiario = diario.filter((i) => i.done).length
  const estoy = doneDiario >= Math.ceil(diario.length / 2) ? 5 : 0
  cats.push({ key: 'estoy', emoji: '📝', label: 'Cómo estoy', pts: estoy, max: 5, detail: estoy ? 'diario hecho' : `${doneDiario} de ${diario.length} del diario` })

  const base = cats.reduce((a, c) => a + c.pts, 0)
  const hospital = log?.location === 'ingreso' || log?.location === 'hospital_dia' || log?.location === 'urgencias'
  const shield = hospital || trafficWindow(ctx, date) === 'infusion'
  const total = shield ? Math.max(base, shieldMin) : base
  return { date, cats, base, shield, total: Math.min(DAY_MAX, total) }
}

export interface WeekPoints {
  start: string // lunes
  end: string // domingo
  days: DayPoints[] // solo los días ya pasados (y hoy)
  total: number
  goal: number
  level: number
  /** Puntos que faltan para la meta (0 si ya está). */
  remaining: number
  /** Días que quedan contando hoy. */
  daysLeft: number
  won: boolean
}

export function weekPoints(anchor: string, inp: RetoInputs, goal = GOAL_DEFAULT, shieldMin = SHIELD_DEFAULT): WeekPoints {
  const start = weekStart(anchor)
  const end = addDays(start, 6)
  const today = todayStr()
  const days: DayPoints[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    if (d > today) break
    days.push(dayPoints(d, inp, shieldMin))
  }
  const total = days.reduce((a, d) => a + d.total, 0)
  const daysLeft = today > end ? 0 : Math.max(0, 7 - days.length + 1)
  return { start, end, days, total, goal, level: levelFor(total, goal), remaining: Math.max(0, goal - total), daysLeft, won: total >= goal }
}

/** El reto de una semana: la fila guardada o los valores por defecto. */
export function challengeFor(challenges: Challenge[], start: string): Partial<Challenge> & { goal: number; shield_min: number } {
  const row = challenges.find((c) => c.week_start === start)
  return { goal: GOAL_DEFAULT, shield_min: SHIELD_DEFAULT, ...(row ?? {}) }
}

/** Nombre que le ha puesto el niño a su criatura (el último que se haya escrito). */
export function creatureName(challenges: Challenge[]) {
  const named = challenges.filter((c) => c.creature_name?.trim()).sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
  return named?.creature_name?.trim() || 'Huma'
}
