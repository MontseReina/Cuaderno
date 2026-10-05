import type { Cycle, DailyLog, Intake, Product } from '../store/types'
import type { Completeness } from './completeness'
import { cycleContext } from './cycle'
import { medicationProgress } from './medication'
import { slotsForMode, weekMode } from './nutrition'
import { MEAL_SLOTS } from './catalogs'

/** Pantalla «Hoy» (0.29.0): el registro del día ordenado por momento, no por pilar.
 *  No cambia qué cuenta como registrado (eso sigue en completeness.ts): solo lo reparte en tres franjas. */
export type Franja = 'manana' | 'tarde' | 'noche'

export const FRANJAS: { key: Franja; label: string; desde: number }[] = [
  { key: 'manana', label: 'Mañana', desde: 0 },
  { key: 'tarde', label: 'Mediodía y tarde', desde: 13 },
  { key: 'noche', label: 'Noche', desde: 20 },
]

/** Franja en la que estamos a esa hora (0-23). De madrugada ya es la mañana del día nuevo. */
export function franjaDeHora(hora: number): Franja {
  return hora >= 20 ? 'noche' : hora >= 13 ? 'tarde' : 'manana'
}

export interface Tarea {
  key: string
  ico: string
  label: string
  detalle?: string
  franja: Franja
  /** Pantalla donde se apunta. */
  to: string
  done: boolean
}

const MOMENTOS_TOMA: Record<Franja, string[]> = {
  manana: ['ayunas', 'manana', 'media_manana'],
  tarde: ['comida', 'media_tarde'],
  noche: ['cena', 'dormir'],
}
const FRANJA_COMIDA: Record<string, Franja> = {
  desayuno: 'manana', media_manana: 'manana', snack_grasa_1: 'manana',
  comida: 'tarde', merienda: 'tarde',
  snack_grasa_2: 'noche', cena: 'noche',
}
const NOMBRE_TOMAS: Record<Franja, string> = { manana: 'Tomas de la mañana', tarde: 'Tomas del mediodía y la tarde', noche: 'Tomas de la noche' }
const ICO_COMIDA: Record<string, string> = { desayuno: '🥣', comida: '🍽️', merienda: '🥣', cena: '🍽️' }

/** Lo que hay que apuntar en el día, repartido en mañana, tarde y noche. */
export function tareasDelDia(
  comp: Completeness, log: DailyLog | undefined, date: string,
  products: Product[], intakes: Intake[], cycles: Cycle[],
): Tarea[] {
  const item = (k: string) => comp.items.find((i) => i.key === k)
  const done = (k: string) => !!item(k)?.done
  const diario = `/diario/${date}`
  const out: Tarea[] = []

  // Mañana: cómo ha dormido, dónde está y la temperatura.
  out.push({ key: 'sueno', ico: '🌙', label: 'Sueño de anoche', detalle: 'Horas, despertares y sincronizadores', franja: 'manana', to: `/biohacking/${date}`, done: done('biohacking') })
  out.push({ key: 'lugar', ico: '📍', label: 'Dónde está hoy', franja: 'manana', to: diario, done: done('location') })
  out.push({ key: 'temp', ico: '🌡️', label: 'Temperatura y constantes', franja: 'manana', to: diario, done: done('temp') })

  // Tomas: una tarea por franja, solo si hay tomas previstas en esa franja.
  for (const f of FRANJAS) {
    const m = medicationProgress(products, intakes, cycles, date, MOMENTOS_TOMA[f.key])
    if (m.planned === 0) continue
    out.push({ key: `tomas_${f.key}`, ico: '💊', label: NOMBRE_TOMAS[f.key], detalle: `${m.taken} de ${m.planned} marcadas`, franja: f.key, to: `/medicacion/${date}`, done: m.taken >= m.planned })
  }

  // Comidas del modo de la semana (quimio o nadir), cada una en su franja.
  const mode = weekMode(log, cycleContext(cycles, date))
  for (const slot of slotsForMode(mode)) {
    const meal = (log?.meals ?? []).find((x) => x.slot === slot.key)
    const apuntada = !!meal && (meal.fraction != null || !!meal.macros || !!meal.time || !!meal.note || !!meal.amount)
    const nombre = MEAL_SLOTS.find((s) => s.key === slot.key)?.label ?? slot.key
    out.push({ key: `comida_${slot.key}`, ico: slot.fat ? '🥑' : ICO_COMIDA[slot.key] ?? '🥣', label: slot.fat ? 'Snack de grasa' : nombre, detalle: 'Qué ha comido y cuánto', franja: FRANJA_COMIDA[slot.key] ?? 'tarde', to: `/nutricion/${date}`, done: apuntada })
  }

  // Tarde: líquidos y movimiento.
  out.push({ key: 'liquidos', ico: '💧', label: 'Líquidos', detalle: 'Agua, caldo e infusiones', franja: 'tarde', to: `/hidratacion/${date}`, done: done('liquidos') })
  out.push({ key: 'ejercicio', ico: '🏃', label: 'Actividad y pasos', franja: 'tarde', to: `/ejercicio/${date}`, done: done('ejercicio') })

  // Noche: resumen del día (orina, deposiciones, dolor, fatiga, ánimo) y cuidados preventivos.
  const resumen = ['orina', 'deposiciones', 'dolor', 'fatiga', 'animo'].map(item).filter((i): i is NonNullable<typeof i> => !!i)
  const faltan = resumen.filter((i) => !i.done).map((i) => i.label.toLowerCase())
  out.push({ key: 'resumen', ico: '📝', label: 'Cómo ha estado hoy', detalle: faltan.length ? `Falta ${faltan.join(', ')}` : 'Orina, deposiciones, dolor, fatiga y ánimo', franja: 'noche', to: diario, done: faltan.length === 0 })
  out.push({ key: 'preventivos', ico: '🧴', label: 'Cuidados preventivos', franja: 'noche', to: diario, done: done('preventivos') })

  return out
}
