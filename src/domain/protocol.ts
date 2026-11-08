import { addDays, diffDays } from './dates'
import { PROTOCOL_34, PROTOCOL_WEEKS } from './catalogs'

export interface ProtocolPoint {
  /** Semana del protocolo (la primera quimio es la semana 0). */
  week: number
  /** Día de tratamiento: el día de la primera quimio es el día 1. */
  day: number
  /** Qué toca esa semana según el Anexo 2, si es una semana de tratamiento. */
  plan: string | null
  total: number
}

type CicloAncla = { protocol_week?: number | null; planned_date: string; start_at?: string | null; deleted_at?: string | null }
export interface Ancla { week: number; date: string }

/** Anclas del protocolo (0.39.1, 08/11/2026): el inicio (semana 0) y cada sesión registrada en Tratamiento
 *  con su semana del protocolo. El hospital numera las semanas por la secuencia del protocolo, no por el
 *  calendario: si una sesión se retrasa (p. ej. la semana 9 fue el 05/11 en vez del 28/10), las semanas
 *  siguientes se corren con ella. */
export function anclasProtocolo(start: string | null | undefined, cycles: CicloAncla[] = []): Ancla[] {
  if (!start) return []
  const out = new Map<number, string>([[0, start.slice(0, 10)]])
  for (const c of cycles) {
    if (c.deleted_at || c.protocol_week == null) continue
    out.set(c.protocol_week, (c.start_at ?? c.planned_date).slice(0, 10))
  }
  return [...out.entries()].map(([week, date]) => ({ week, date })).sort((a, b) => a.week - b.week)
}

/** Fecha de una semana del protocolo: la registrada si la hay; si no, la última sesión registrada
 *  anterior + 7 días por semana. */
export function fechaSemana(start: string | null | undefined, cycles: CicloAncla[], week: number): string | null {
  const a = anclasProtocolo(start, cycles).filter((x) => x.week <= week).pop()
  return a ? addDays(a.date, (week - a.week) * 7) : null
}

/** Semana y día del protocolo de una fecha. La semana se cuenta desde la última sesión registrada
 *  (sin pasar de la semana anterior a la siguiente sesión registrada); el día, desde el día 1 del tratamiento. */
export function protocolPoint(start: string | null | undefined, date: string, cycles: CicloAncla[] = []): ProtocolPoint | null {
  if (!start) return null
  const d = diffDays(date, start)
  if (d < 0) return null
  const anclas = anclasProtocolo(start, cycles)
  const prev = anclas.filter((a) => a.date <= date).sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week).pop() ?? anclas[0]
  let week = prev.week + Math.floor(diffDays(date, prev.date) / 7)
  const next = anclas.filter((a) => a.date > date && a.week > prev.week).sort((a, b) => a.week - b.week)[0]
  if (next) week = Math.min(week, next.week - 1)
  return { week, day: d + 1, plan: PROTOCOL_34.find((x) => x.week === week)?.label ?? null, total: PROTOCOL_WEEKS }
}

/** Nombre completo de cada sesión del Anexo 2 (para el calendario). */
const PLAN_NOMBRE: Record<string, { corto: string; largo: string; tipo: 'mtx' | 'cddp' | 'adm' | 'cirugia' }> = {
  'MTX': { corto: 'MTX', largo: 'Metotrexato', tipo: 'mtx' },
  'CDP + ADM': { corto: 'CDDP + ADM', largo: 'Cisplatino y Adriamicina', tipo: 'cddp' },
  'CDP': { corto: 'CDDP', largo: 'Cisplatino', tipo: 'cddp' },
  'ADM*': { corto: 'ADM', largo: 'Adriamicina (tras la cirugía)', tipo: 'adm' },
  'Cirugía': { corto: 'Cirugía', largo: 'Cirugía (posible)', tipo: 'cirugia' },
}

export interface DiaTratamiento {
  week: number
  corto: string
  largo: string
  tipo: 'mtx' | 'cddp' | 'adm' | 'cirugia'
  /** Hay una sesión registrada en Tratamiento para esa semana (la fecha es la registrada). */
  registrada: boolean
  /** Nº de ciclo: el de Tratamiento si está registrada; si no, el de la hoja antes de la cirugía (sem. 0-1 = 1, 4-5 = 2). Después de la cirugía, pendiente. */
  ciclo: number | null
}

/** Días de quimio y cirugía del protocolo, por fecha. Si en Tratamiento hay una sesión con esa semana
 *  del protocolo, manda su fecha real; si no, se calcula desde la última sesión registrada (fechaSemana). */
export function calendarioTratamiento(start: string | null | undefined, cycles: (CicloAncla & { number?: number | null })[]): Map<string, DiaTratamiento> {
  const out = new Map<string, DiaTratamiento>()
  if (!start) return out
  for (const p of PROTOCOL_34) {
    const n = PLAN_NOMBRE[p.label] ?? { corto: p.label, largo: p.label, tipo: 'mtx' as const }
    const reg = cycles.find((c) => c.protocol_week === p.week)
    const date = reg ? (reg.start_at ?? reg.planned_date).slice(0, 10) : fechaSemana(start, cycles, p.week) ?? addDays(start, p.week * 7)
    const cicloHoja: Record<number, number> = { 0: 1, 1: 1, 4: 2, 5: 2 }
    const ciclo = n.tipo === 'cirugia' ? null : reg?.number ?? cicloHoja[p.week] ?? null
    out.set(date, { week: p.week, ...n, registrada: !!reg, ciclo })
  }
  return out
}
