/** Kilocalorías estimadas de lo que se escribe en cada toma (0.33.0, traído de New Version).
 *  Cada alimento reconocido cuenta por su ración casera (o por el número escrito) y por la cantidad marcada:
 *  en comida y cena, la parte del plato dibujado que le toca (verdura, proteína, hidratos); en el resto,
 *  Entera, ¾ o Media. En media mañana y media tarde, si no se escribe nada, cuenta el batido.
 *  Son una estimación para saber más o menos cuánto come al día: ni un tope ni un objetivo. */
import { ALIMENTOS, leerAlimentos, type Grupo, type Leido } from './alimentos'
import { MEAL_SLOTS, TOMAS } from './catalogs'
import type { DailyLog, Meal } from '../store/types'

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
  /** No se ha escrito nada y cuenta el batido de siempre (media mañana y media tarde). */
  batido: boolean
}

const tomaDe = (slot: string) => TOMAS.find((t) => t.key === slot)
const nombre = (slot: string) => tomaDe(slot)?.label ?? MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot

/** ¿Cuenta esta toma como tomada? Marcada con algo distinto de «No», o con algo escrito o una hora. */
export const tomada = (m?: Meal) => !!m && m.fraction !== 0 && (m.fraction != null || !!m.note?.trim() || !!m.time || !!m.end)

/** Kilocalorías de una toma. */
export function kcalToma(m: Meal): KcalToma {
  const t = tomaDe(m.slot)
  const deToma = m.fraction != null && m.fraction > 0 ? m.fraction : 1
  if (!m.note?.trim()) {
    if (t?.batido && tomada(m)) {
      const k = Math.round(BATIDO.k * deToma)
      return { items: [{ alimento: BATIDO, texto: 'batido', unidades: 1, conNumero: false, kcal: BATIDO.k, ini: 0, fin: 0, factor: deToma, segun: deToma !== 1 ? 'toma' : null, kcalContadas: k }], sinReconocer: [], total: k, batido: true }
    }
    return { items: [], sinReconocer: [], total: 0, batido: false }
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
  return { items, sinReconocer, total: items.reduce((s, i) => s + i.kcalContadas, 0), batido: false }
}

export interface KcalDia {
  total: number
  /** Tomas hechas que no se pueden contar: sin escribir qué se tomó o sin ningún alimento reconocido. */
  sinDato: string[]
  /** Tomas en las que algún trozo no se ha reconocido: cuentan solo lo reconocido. */
  enParte: string[]
  /** Kilocalorías por toma (solo las tomadas). */
  porToma: { slot: string; nombre: string; kcal: number }[]
}

export function kcalDia(log: DailyLog | undefined): KcalDia {
  let total = 0
  const sinDato: string[] = [], enParte: string[] = [], porToma: KcalDia['porToma'] = []
  for (const m of log?.meals ?? []) {
    if (!tomada(m)) continue
    const k = kcalToma(m)
    if (!k.items.length) { sinDato.push(nombre(m.slot)); continue }
    if (k.sinReconocer.length) enParte.push(nombre(m.slot))
    total += k.total
    porToma.push({ slot: m.slot, nombre: nombre(m.slot), kcal: k.total })
  }
  return { total: Math.round(total), sinDato, enParte, porToma }
}

export const fmtKcal = (n: number) => Math.round(n).toLocaleString('es-ES')
