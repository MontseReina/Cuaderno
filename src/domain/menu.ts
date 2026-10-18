/** Menú de la nutricionista (0.33.0): qué platos tocan cada día en cada toma. El menú vive en la base de datos
 *  (tabla `menus`) y se carga desde la app con un archivo; aquí solo está cómo leerlo. */
import type { MealSlot, MenuData, MenuDish, MenuRow } from '../store/types'
import { diffDays } from './dates'
import { PAUTA_OCT_DESDE } from './catalogs'

export interface MenuHoy {
  /** 0 = lunes. */
  indice: number
  /** Semana 1 o 2 (platos que se turnan). */
  semana: 1 | 2
  platos: (slot: string) => MenuDish[]
  hora: (slot: string) => string | null
}

/** Menú activo (el último cargado). */
export const menuActivo = (rows: MenuRow[]) => rows.filter((r) => r.active && !r.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null

/** Platos de un día. `null` si no hay menú o el día es anterior al menú o a la pauta del 18/10. */
export function menuDelDia(m: MenuData | null | undefined, date: string): MenuHoy | null {
  if (!m || !m.dias?.length) return null
  if (date < PAUTA_OCT_DESDE) return null
  const indice = (new Date(date + 'T12:00:00').getDay() + 6) % 7
  const semanas = Math.floor(diffDays(date, m.desde) / 7)
  const semana = (((semanas % 2) + 2) % 2) === 0 ? 1 : 2
  const dia = m.dias[indice % m.dias.length] ?? {}
  return {
    indice, semana,
    platos: (slot) => (dia[slot as MealSlot] ?? [])
      .filter((r) => typeof r === 'string' || !r.semana || r.semana === semana)
      .map((r) => { const id = typeof r === 'string' ? r : r.id; const p = m.platos[id]; return { id, n: p?.nombre ?? id, k: p?.kcal, p: p?.partes } }),
    hora: (slot) => m.horas?.[slot as MealSlot] ?? null,
  }
}

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
/** Lee el archivo del menú. `null` si no es un menú de Huma válido. */
export function leerMenu(texto: string): MenuData | null {
  let x: unknown
  try { x = JSON.parse(texto) } catch { return null }
  if (!esObj(x) || x.huma_menu !== 1 || typeof x.nombre !== 'string' || typeof x.desde !== 'string') return null
  if (!Array.isArray(x.dias) || x.dias.length !== 7 || !esObj(x.platos)) return null
  for (const d of x.dias) {
    if (!esObj(d)) return null
    for (const refs of Object.values(d)) {
      if (!Array.isArray(refs)) return null
      for (const r of refs) { const id = typeof r === 'string' ? r : esObj(r) ? r.id : null; if (typeof id !== 'string' || !(id in (x.platos as object))) return null }
    }
  }
  return x as unknown as MenuData
}
