import type { Cycle } from '../store/types'
import { addDays, diffDays } from './dates'
import { PROTOCOL_34 } from './catalogs'

/** Fases del tratamiento para las pautas de alimentación y el calendario (regla de Montserrate, 28/09/2026).
 *  Las sesiones salen de Tratamiento (fecha definitiva: inicio real o, si no, la prevista) y, para las semanas
 *  del protocolo que aún no están en Tratamiento, de la hoja del protocolo (Anexo 2: siempre en miércoles,
 *  inicio + 7 × semana). */
export type Fase = 'mtx' | 'cddp' | 'nadir'
export type Tramo = 'vispera' | 'perfusion' | 'rescate' | 'resto' | 'perfusion48' | 'alta' | 'nadir'
export interface Sesion {
  date: string
  end: string
  kind: 'mtx' | 'cddp' | 'cirugia'
  week: number | null
  cycle?: Cycle
  /** Aún no está en Tratamiento: fecha sacada del protocolo. */
  delProtocolo: boolean
}

const KIND: Record<string, Sesion['kind']> = { 'MTX': 'mtx', 'CDP + ADM': 'cddp', 'CDP': 'cddp', 'ADM*': 'cddp', 'Cirugía': 'cirugia' }

export function sesionesTratamiento(start: string | null | undefined, cycles: Cycle[]): Sesion[] {
  const out: Sesion[] = []
  const usadas = new Set<number>()
  for (const c of cycles) {
    const ds = c.drugs ?? []
    const kind: Sesion['kind'] | null = ds.includes('MTX') ? 'mtx' : ds.includes('CDDP') || ds.includes('ADM') ? 'cddp' : null
    if (!kind) continue
    const date = (c.start_at ?? c.planned_date).slice(0, 10)
    out.push({ date, end: (c.end_at ?? c.start_at ?? c.planned_date).slice(0, 10), kind, week: c.protocol_week ?? null, cycle: c, delProtocolo: false })
    if (c.protocol_week != null) usadas.add(c.protocol_week)
  }
  if (start) {
    for (const p of PROTOCOL_34) {
      if (usadas.has(p.week)) continue
      const date = addDays(start, p.week * 7)
      out.push({ date, end: date, kind: KIND[p.label] ?? 'mtx', week: p.week, delProtocolo: true })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Fase y tramo de un día:
 *  - La víspera de un metotrexato y los 7 días desde su inicio (D0-D6) → semana de metotrexato.
 *  - 7 días desde el inicio del cisplatino y/o adriamicina (D0-D6) → semana de cisplatino.
 *  - Desde el 8.º día (D7) hasta la siguiente sesión → semana nadir (tramo «nadir» hasta D14).
 *  - Cirugía, o más de 7 días tras un metotrexato sin otra sesión → null. */
export function faseDelDia(start: string | null | undefined, cycles: Cycle[], date: string, sesiones?: Sesion[]): { fase: Fase; tramo: Tramo | null; dia: number } | null {
  const ses = sesiones ?? sesionesTratamiento(start, cycles)
  const manana = addDays(date, 1)
  const hoySesion = ses.some((s) => s.date === date)
  if (!hoySesion && ses.some((s) => s.kind === 'mtx' && s.date === manana)) return { fase: 'mtx', tramo: 'vispera', dia: -1 }
  const last = ses.filter((s) => s.date <= date).pop()
  if (!last || last.kind === 'cirugia') return null
  const d = diffDays(date, last.date)
  if (last.kind === 'mtx') {
    if (d > 6) return null
    const finRescate = last.cycle?.rescue?.end ? last.cycle.rescue.end.slice(0, 10) : addDays(last.date, 3)
    return { fase: 'mtx', tramo: date <= last.end ? 'perfusion' : date <= finRescate ? 'rescate' : 'resto', dia: d }
  }
  if (d <= 6) {
    const finPerf = last.cycle?.end_at ? last.end : addDays(last.date, 2)
    return { fase: 'cddp', tramo: date <= finPerf ? 'perfusion48' : 'alta', dia: d }
  }
  return { fase: 'nadir', tramo: d <= 14 ? 'nadir' : null, dia: d }
}
