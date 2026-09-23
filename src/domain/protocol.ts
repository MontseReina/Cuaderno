import { diffDays } from './dates'
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
