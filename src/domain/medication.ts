import type { Cycle, Intake, Product } from '../store/types'
import { afterChemoGate, cycleContext, type CycleContext } from './cycle'

export type TrafficWindow = 'mtx' | 'cddp_adm' | 'nadir' | 'infusion'

/** Ventana del semáforo en la que estamos ese día (día de infusión, ciclo, nadir…). */
export function trafficWindow(ctx: CycleContext, date: string): TrafficWindow | null {
  if (!ctx.cycle) return null
  if (ctx.day === 0 || (ctx.inCycle && ctx.cycle.end_at && date <= ctx.cycle.end_at.slice(0, 10))) return 'infusion'
  if (ctx.inCycle) return ctx.cycle.drugs.includes('MTX') ? 'mtx' : 'cddp_adm'
  return ctx.nadir ? 'nadir' : null
}

export interface MedProgress {
  /** Tomas previstas ese día (sin contar lo que está en rojo, lo de «solo si…» ni lo que aún no toca). */
  planned: number
  /** Tomas marcadas. */
  taken: number
}

/** Cuántas tomas de medicación y suplementos tocaban ese día y cuántas están marcadas. */
export function medicationProgress(products: Product[], intakes: Intake[], cycles: Cycle[], date: string): MedProgress {
  const ctx = cycleContext(cycles, date)
  const wk = trafficWindow(ctx, date)
  const dow = new Date(date + 'T12:00').getDay()
  let planned = 0
  let taken = 0
  for (const p of products) {
    if (p.end_date && p.end_date <= date) continue
    if (p.start_date && p.start_date > date) continue
    if (!p.moments?.length) continue // a demanda
    if (p.condition) continue // «solo si hay fatiga»: no es obligatorio
    if (p.weekdays?.length && !p.weekdays.includes(dow)) continue
    if (afterChemoGate(p, cycles, date)?.waiting) continue
    if (wk && p.traffic?.[wk] === 'rojo') continue
    for (const m of p.moments) {
      planned++
      if (intakes.some((i) => i.product_id === p.id && i.date === date && i.moment === m && i.taken)) taken++
    }
  }
  return { planned, taken }
}
