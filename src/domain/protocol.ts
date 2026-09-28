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

/** Semana y día del protocolo a partir del día 1 del tratamiento. */
export function protocolPoint(start: string | null | undefined, date: string): ProtocolPoint | null {
  if (!start) return null
  const d = diffDays(date, start)
  if (d < 0) return null
  const week = Math.floor(d / 7)
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

/** Días de quimio y cirugía del protocolo, por fecha. La quimio es siempre en miércoles
 *  (día 1 = inicio del tratamiento + 7 × semana). Si en Tratamiento hay una sesión con esa semana
 *  del protocolo, manda su fecha real (por si hubo retraso). */
export function calendarioTratamiento(start: string | null | undefined, cycles: { protocol_week?: number | null; planned_date: string; start_at?: string | null; number?: number | null }[]): Map<string, DiaTratamiento> {
  const out = new Map<string, DiaTratamiento>()
  if (!start) return out
  for (const p of PROTOCOL_34) {
    const n = PLAN_NOMBRE[p.label] ?? { corto: p.label, largo: p.label, tipo: 'mtx' as const }
    const reg = cycles.find((c) => c.protocol_week === p.week)
    const date = reg ? (reg.start_at ?? reg.planned_date).slice(0, 10) : addDays(start, p.week * 7)
    const cicloHoja: Record<number, number> = { 0: 1, 1: 1, 4: 2, 5: 2 }
    const ciclo = n.tipo === 'cirugia' ? null : reg?.number ?? cicloHoja[p.week] ?? null
    out.set(date, { week: p.week, ...n, registrada: !!reg, ciclo })
  }
  return out
}
