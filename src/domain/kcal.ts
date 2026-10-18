/** Kilocalorías estimadas (0.33.0, como New Version).
 *  - Si se escribe algo en «Otro», sustituye al menú: cada alimento reconocido cuenta por su ración casera (o por el
 *    número escrito) y por la cantidad marcada (en comida y cena, la parte del plato dibujado; en el resto, Entera,
 *    ¾ o Media).
 *  - Si no se escribe nada, cuentan los platos del menú de ese día (o el batido en media mañana y media tarde).
 *  Son una estimación para saber más o menos cuánto come al día: ni un tope ni un objetivo. */
import { ALIMENTOS, leerAlimentos, type Grupo, type Leido } from './alimentos'
import { MEAL_SLOTS, TOMAS } from './catalogs'
import type { DailyLog, Meal, MenuDish } from '../store/types'
import type { MenuHoy } from './menu'

/** Cantidad de cada parte del plato dibujado: nada, poca, la que toca y (hidratos) más de la que toca. */
const FACTOR_PLATO = { veg: [0, 0.5, 1], prot: [0, 0.5, 1], starch: [0, 0.5, 1, 1.5] } as const
const PARTE_DEL_PLATO: Partial<Record<Grupo, keyof typeof FACTOR_PLATO>> = { verdura: 'veg', proteina: 'prot', hidrato: 'starch' }
export const BATIDO = ALIMENTOS.find((a) => a.id === 'batido')!

export interface LeidoContado extends Leido {
  /** Parte que se cuenta: la del plato o la de Entera, ¾ o Media. 1 si se escribió un número. */
  factor: number
  segun: 'numero' | 'plato' | 'toma' | null
  kcalContadas: number
}
export interface KcalToma {
  items: LeidoContado[]
  sinReconocer: string[]
  total: number
  /** De dónde salen: lo escrito, los platos del menú o el batido. */
  fuente: 'escrito' | 'menu' | 'batido' | null
  /** Platos del menú contados (fuente = menu), con sus kcal. */
  platos: { n: string; k: number }[]
}

const tomaDe = (slot: string) => TOMAS.find((t) => t.key === slot)
const nombre = (slot: string) => tomaDe(slot)?.label ?? MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot

/** ¿Cuenta esta toma como tomada? Marcada con algo distinto de «No», o con algo escrito o una hora. */
export const tomada = (m?: Meal) => !!m && m.fraction !== 0 && (m.fraction != null || !!m.note?.trim() || !!m.time || !!m.end)

/** Parte que se tomó de cada zona del plato dibujado (1 si no se ha marcado) y la media para el resto (aceite, salsas). */
export function factoresPlato(m?: Meal) {
  const f = (k: keyof typeof FACTOR_PLATO): number | null => { const n = m?.macros?.[k]; return n == null ? null : (FACTOR_PLATO[k] as readonly number[])[n] ?? 1 }
  const veg = f('veg'), prot = f('prot'), hid = f('starch')
  const marcados = [veg, prot, hid].filter((v): v is number => v != null)
  const resto = marcados.length ? marcados.reduce((s, v) => s + v, 0) / marcados.length : 1
  return { veg: veg ?? 1, prot: prot ?? 1, hid: hid ?? 1, resto }
}
/** Kilocalorías de un plato del menú en una comida con plato dibujado, según lo marcado en el plato. */
export function kcalConPlato(d: MenuDish, m?: Meal): number | null {
  if (d.k == null) return null
  const f = factoresPlato(m)
  if (!d.p) return d.k * f.resto
  const veg = d.p.veg ?? 0, prot = d.p.prot ?? 0, hid = d.p.hid ?? 0
  const resto = Math.max(0, 1 - veg - prot - hid)
  return d.k * (veg * f.veg + prot * f.prot + hid * f.hid + resto * f.resto)
}

/** Platos del menú que cuentan en una toma: los guardados al marcarla o, si no, los del menú del día. */
export function platosDeToma(m: Meal, menu: MenuHoy | null): MenuDish[] {
  if (m.dishes?.length) return m.dishes
  return menu?.platos(m.slot) ?? []
}

const vacio = (): KcalToma => ({ items: [], sinReconocer: [], total: 0, fuente: null, platos: [] })

/** Kilocalorías de una toma. */
export function kcalToma(m: Meal, menu: MenuHoy | null = null): KcalToma {
  const t = tomaDe(m.slot)
  const deToma = m.fraction != null && m.fraction > 0 ? m.fraction : 1
  if (!tomada(m)) return vacio()
  if (!m.note?.trim()) {
    const platos = platosDeToma(m, menu)
    if (t?.batido && m.choice !== 'menu') {
      const k = Math.round(BATIDO.k * deToma)
      return { ...vacio(), total: k, fuente: 'batido', platos: [{ n: 'Batido de siempre', k }] }
    }
    const cuentan = platos.filter((p, i) => i === 0 || m.taken?.[p.id] !== 'no')
    if (!cuentan.length || cuentan.some((p) => p.k == null)) return vacio()
    const contados = cuentan.map((p) => ({ n: p.n, k: Math.round(t?.plato ? kcalConPlato(p, m)! : p.k! * deToma) }))
    return { ...vacio(), total: contados.reduce((s, p) => s + p.k, 0), fuente: 'menu', platos: contados }
  }
  const { leidos, sinReconocer } = leerAlimentos(m.note)
  const items = leidos.map((l): LeidoContado => {
    if (l.conNumero) return { ...l, factor: 1, segun: 'numero', kcalContadas: l.kcal }
    const parte = t?.plato ? PARTE_DEL_PLATO[l.alimento.grupo] : undefined
    const nivel = parte ? m.macros?.[parte] : null
    const factor = parte && nivel != null ? (FACTOR_PLATO[parte] as readonly number[])[nivel] ?? 1 : deToma
    const segun = parte && nivel != null ? 'plato' : deToma !== 1 ? 'toma' : null
    return { ...l, factor, segun, kcalContadas: Math.round(l.kcal * factor) }
  })
  return { items, sinReconocer, total: items.reduce((s, i) => s + i.kcalContadas, 0), fuente: items.length ? 'escrito' : null, platos: [] }
}

export interface KcalDia {
  total: number
  /** Tomas hechas que no se pueden contar: sin escribir qué se tomó o sin ningún alimento reconocido. */
  sinDato: string[]
  /** Tomas en las que algún trozo no se ha reconocido: cuentan solo lo reconocido. */
  enParte: string[]
  /** Kilocalorías por toma (solo las tomadas). */
  porToma: { slot: string; nombre: string; kcal: number }[]
  /** Lo previsto ese día: platos del menú en desayuno, comida y cena y el batido en media mañana y media tarde.
   *  `null` sin menú o si algún plato no tiene cifra. */
  previsto: number | null
}

export function kcalDia(log: DailyLog | undefined, menu: MenuHoy | null = null): KcalDia {
  let total = 0
  const sinDato: string[] = [], enParte: string[] = [], porToma: KcalDia['porToma'] = []
  for (const m of log?.meals ?? []) {
    if (!tomada(m)) continue
    const k = kcalToma(m, menu)
    if (!k.fuente) { sinDato.push(nombre(m.slot)); continue }
    if (k.sinReconocer.length) enParte.push(nombre(m.slot))
    total += k.total
    porToma.push({ slot: m.slot, nombre: nombre(m.slot), kcal: k.total })
  }
  let previsto: number | null = null
  if (menu) {
    previsto = 0
    for (const t of TOMAS) {
      if (t.batido) { previsto += BATIDO.k; continue }
      const ps = menu.platos(t.key)
      if (!ps.length || ps.some((p) => p.k == null)) { previsto = null; break }
      previsto += ps.reduce((s, p) => s + p.k!, 0)
    }
  }
  return { total: Math.round(total), sinDato, enParte, porToma, previsto }
}

export const fmtKcal = (n: number) => Math.round(n).toLocaleString('es-ES')
