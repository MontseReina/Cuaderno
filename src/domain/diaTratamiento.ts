import type { Cycle } from '../store/types'
import { diffDays } from './dates'
import { faseDelDia, sesionesTratamiento } from './fases'
import { calendarioTratamiento, protocolPoint } from './protocol'

/** Cómo se nombra un día del tratamiento en lugar de la «D» (decisión de Montserrate, 28/09/2026):
 *  «Ciclo x · Semana x de 34 · Día x tras metotrexato / Día x tras cisplatino / Día x nadir · Día x del tratamiento».
 *  El nadir empieza el 8.º día del cisplatino (D7 = día 1 de nadir). */
export interface DiaTratamientoTexto {
  ciclo: number | null
  semana: string | null
  fase: string | null
  total: string | null
  /** Todo junto, separado por « · ». */
  texto: string
}

export function faseTexto(start: string | null | undefined, cycles: Cycle[], date: string): string | null {
  const ses = sesionesTratamiento(start, cycles)
  const f = faseDelDia(start, cycles, date, ses)
  if (f?.tramo === 'vispera') return 'Víspera del metotrexato'
  if (f?.fase === 'mtx') return f.dia === 0 ? 'Día del metotrexato' : `Día ${f.dia} tras metotrexato`
  if (f?.fase === 'cddp') return f.dia === 0 ? 'Día del cisplatino' : `Día ${f.dia} tras cisplatino`
  if (f?.fase === 'nadir') return `Día ${f.dia - 6} nadir`
  const last = ses.filter((s) => s.date <= date).pop()
  if (!last) return null
  if (last.kind === 'cirugia') { const d = diffDays(date, last.date); return d === 0 ? 'Día de la cirugía' : `Día ${d} tras la cirugía` }
  return `Día ${diffDays(date, last.date)} tras ${last.kind === 'mtx' ? 'metotrexato' : 'cisplatino'}`
}

export function diaTratamiento(start: string | null | undefined, cycles: Cycle[], date: string): DiaTratamientoTexto | null {
  const pp = protocolPoint(start, date)
  const ses = sesionesTratamiento(start, cycles).filter((s) => s.kind !== 'cirugia')
  const last = ses.filter((s) => s.date <= date).pop()
  const ciclo = last ? (last.cycle?.number ?? calendarioTratamiento(start, cycles).get(last.date)?.ciclo ?? null) : null
  const fase = faseTexto(start, cycles, date)
  const semana = pp ? `Semana ${pp.week} de ${pp.total}` : null
  const total = pp ? `Día ${pp.day} del tratamiento` : null
  const partes = [ciclo != null ? `Ciclo ${ciclo}` : null, semana, fase, total].filter((x): x is string => !!x)
  if (!partes.length) return null
  return { ciclo, semana, fase, total, texto: partes.join(' · ') }
}
