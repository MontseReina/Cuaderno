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
      .map((r) => { const id = typeof r === 'string' ? r : r.id; const p = m.platos[id]; return { id, n: p?.nombre ?? id, k: p?.kcal, p: p?.partes, g: p?.prot_g } }),
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

/** 0.48.0 · Archivo de ajuste: la proteína total de cada plato, por su nombre, para añadirla al menú que ya está
 *  cargado sin cambiar nada más. `{ "huma_menu_ajuste": 1, "prot_g": { "Libritos de lomo": 175, … } }`. */
export interface AjusteMenu { huma_menu_ajuste: 1; prot_g: Record<string, number>; nota?: string }
export function leerAjuste(texto: string): AjusteMenu | null {
  let x: unknown
  try { x = JSON.parse(texto) } catch { return null }
  if (!esObj(x) || x.huma_menu_ajuste !== 1 || !esObj(x.prot_g)) return null
  if (Object.values(x.prot_g).some((v) => typeof v !== 'number' || v < 0)) return null
  return x as unknown as AjusteMenu
}
const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/⭐/g, '').replace(/\([^)]*\)/g, ' ')
  .toLowerCase().replace(/[^a-zñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
/** Añade la proteína a los platos del menú: por nombre exacto (sin tildes ni paréntesis) o, si no, por el
 *  principio del nombre. Devuelve el menú nuevo y los platos que se han quedado sin dato. */
export function aplicarAjuste(m: MenuData, a: AjusteMenu): { data: MenuData; con: number; sin: string[] } {
  const tabla = Object.entries(a.prot_g).map(([n, g]) => ({ k: clave(n), g }))
  const platos: MenuData['platos'] = {}
  const sin: string[] = []
  let con = 0
  for (const [id, p] of Object.entries(m.platos)) {
    const k = clave(p.nombre)
    const tres = (x: string) => x.split(' ').slice(0, 3).join(' ')
    const porTres = tabla.filter((t) => tres(t.k) === tres(k) && tres(k).split(' ').length === 3)
    const hit = tabla.find((t) => t.k === k) ?? tabla.find((t) => t.k.length >= 6 && (k.startsWith(t.k) || t.k.startsWith(k))) ?? (porTres.length === 1 ? porTres[0] : undefined)
    if (hit) { platos[id] = { ...p, prot_g: hit.g }; con++ } else { platos[id] = p; if (p.prot_g == null) sin.push(p.nombre) }
  }
  return { data: { ...m, platos }, con, sin }
}
