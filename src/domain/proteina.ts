/** Control de proteína en Nutrición (0.47.0, decisión de Montserrate del 11/11/2026).
 *
 *  Dos mediciones separadas:
 *  1. Proteína del día: suma de las 5 ingestas (desayuno, media mañana, comida, media tarde y cena). Ideal 360-400 g.
 *  2. Mínimo 120 g en cada ingesta principal (desayuno, comida y cena).
 *
 *  Se cuenta el PESO de los alimentos proteicos (en cocinado; la leche en ml), no los gramos de proteína como
 *  nutriente («proteína total», no efectiva). La proteína real se estima aparte, solo como orientación.
 *  En los batidos, la proteína de guisante va por defecto: 30 g a media mañana y 15 g a media tarde (1 cazo = 30 g). */
import type { Meal, MealSlot } from '../store/types'

/** Desde este día se lleva el control (los días anteriores no tienen estos datos). */
export const PROTEINA_DESDE = '2026-11-11'
export const META_PRINCIPAL = 120
export const DIA_MIN = 360
export const DIA_MAX = 400
export const CAZO_G = 30

export interface AlimentoProteico {
  id: string
  label: string
  /** Gramos de proteína por 100 g (o 100 ml), aproximados; solo para la estimación orientativa. */
  p: number
  /** Cantidad que se pone al añadirlo. */
  def: number
  unit: 'g' | 'ml'
  hint: string
  /** Proteína en polvo: se elige por cazos. */
  cazo?: boolean
}

export const ALIMENTOS_PROTEICOS: AlimentoProteico[] = [
  { id: 'carne', label: 'Carne', p: 28, def: 120, unit: 'g', hint: 'Peso cocinado' },
  { id: 'pescado', label: 'Pescado', p: 22, def: 120, unit: 'g', hint: 'Peso cocinado' },
  { id: 'marisco', label: 'Marisco', p: 22, def: 120, unit: 'g', hint: 'Peso cocinado' },
  { id: 'huevo', label: 'Huevo', p: 13, def: 55, unit: 'g', hint: '1 huevo ≈ 55 g' },
  { id: 'leche', label: 'Leche', p: 3.3, def: 200, unit: 'ml', hint: '1 vaso ≈ 200 ml' },
  { id: 'queso', label: 'Queso', p: 25, def: 30, unit: 'g', hint: '1 loncha ≈ 30 g' },
  { id: 'yogur', label: 'Yogur', p: 4, def: 125, unit: 'g', hint: '1 yogur ≈ 125 g' },
  { id: 'jamon', label: 'Jamón', p: 30, def: 20, unit: 'g', hint: '1 loncha ≈ 20 g' },
  { id: 'guisante', label: 'Proteína de guisante', p: 80, def: 15, unit: 'g', hint: `1 cazo = ${CAZO_G} g`, cazo: true },
]
export const alimentoProteico = (id: string) => ALIMENTOS_PROTEICOS.find((a) => a.id === id)

/** Cazos para la proteína de guisante. */
export const CAZOS: { g: number; label: string }[] = [
  { g: Math.round(CAZO_G / 3), label: '⅓' },
  { g: CAZO_G / 2, label: '½' },
  { g: CAZO_G, label: '1 cazo' },
]

export interface ItemProteico { food: string; g: number }

const PRINCIPALES: MealSlot[] = ['desayuno', 'comida', 'cena']
const BATIDOS: Partial<Record<MealSlot, number>> = { media_manana: CAZO_G, merienda: CAZO_G / 2 }
export const esPrincipal = (slot: MealSlot) => PRINCIPALES.includes(slot)

/** Lo que se pone por defecto si no se ha anotado nada: en los batidos, la proteína de guisante de siempre. */
export function porDefecto(slot: MealSlot): ItemProteico[] {
  const g = BATIDOS[slot]
  return g ? [{ food: 'guisante', g }] : []
}

/** Alimentos proteicos de una ingesta: los anotados o, si no hay, los de por defecto (salvo snack del menú u «otro»). */
export function itemsDe(m: Meal | undefined, slot: MealSlot): { items: ItemProteico[]; anotado: boolean } {
  if (m?.prot) return { items: m.prot, anotado: true }
  if (m?.choice === 'menu') return { items: [], anotado: false }
  return { items: porDefecto(slot), anotado: false }
}

export type Nivel = 'verde' | 'amarillo' | 'rojo' | 'gris'

export interface ProteinaToma {
  slot: MealSlot
  principal: boolean
  /** Se ha marcado cuánto se tomó (Entera, ¾, Media, Casi nada o No). */
  registrada: boolean
  servido: number
  /** Gramos de alimento proteico tomados = servido × parte tomada. */
  tomado: number
  /** Proteína real estimada (orientativa). */
  proteina: number
  /** Solo principales: frente a 120 g. */
  nivel: Nivel
  sinAlimentos: boolean
}

export function proteinaToma(m: Meal | undefined, slot: MealSlot): ProteinaToma {
  const { items } = itemsDe(m, slot)
  const f = m?.fraction
  const registrada = f != null
  let servido = 0
  let prot = 0
  for (const it of items) {
    const a = alimentoProteico(it.food)
    servido += it.g
    prot += a ? (it.g * a.p) / 100 : 0
  }
  const tomado = registrada ? Math.round(servido * f!) : 0
  const proteina = registrada ? Math.round(prot * f!) : 0
  const principal = esPrincipal(slot)
  const nivel: Nivel = !registrada ? 'gris' : tomado >= META_PRINCIPAL ? 'verde' : tomado >= (META_PRINCIPAL * 2) / 3 ? 'amarillo' : 'rojo'
  return { slot, principal, registrada, servido, tomado, proteina, nivel, sinAlimentos: items.length === 0 }
}

export interface ProteinaDia {
  tomas: ProteinaToma[]
  total: number
  proteina: number
  pendientes: number
  /** Estado del total frente a 360-400 g. */
  estado: 'curso' | 'rango' | 'encima' | 'debajo'
  principalesEnMeta: number
  principalesRegistradas: number
}

export function proteinaDia(meals: Meal[], slots: MealSlot[]): ProteinaDia {
  const tomas = slots.map((s) => proteinaToma(meals.find((m) => m.slot === s), s))
  const total = tomas.reduce((s, t) => s + t.tomado, 0)
  const proteina = tomas.reduce((s, t) => s + t.proteina, 0)
  const pendientes = tomas.filter((t) => !t.registrada).length
  const estado = total > DIA_MAX ? 'encima' : total >= DIA_MIN ? 'rango' : pendientes > 0 ? 'curso' : 'debajo'
  const ps = tomas.filter((t) => t.principal)
  return {
    tomas, total, proteina, pendientes, estado,
    principalesEnMeta: ps.filter((t) => t.nivel === 'verde').length,
    principalesRegistradas: ps.filter((t) => t.registrada).length,
  }
}
