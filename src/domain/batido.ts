/** El batido de media mañana y media tarde (0.48.0, receta que da la familia el 13/11/2026).
 *
 *  - Bebida de almendras (sin azúcar), proteína de guisante y plátano.
 *  - Media mañana: 30 g de proteína de guisante y ½ plátano. Media tarde: 15 g de proteína y ⅓ de plátano.
 *  - A veces, 1 cucharadita de aceite de coco o de ghee, y un poco de calabaza o de boniato (se marca en la ficha;
 *    «un poco» = unos 50 g cocidos, supuesto de Claude).
 *  - La bebida de almendras (sin azúcar) cuenta por los ml escritos en «Líquido»; sin escribir, 200 ml a media
 *    mañana y la mitad, 100 ml, a media tarde (13/11). Esos mismos ml cuentan en Hidratación (`BATIDO_ML_TOMA`).
 *
 *  Kilocalorías aproximadas (tablas de composición y etiquetas habituales, redondeadas): bebida de almendras sin
 *  azúcar 14 kcal/100 ml, proteína de guisante en polvo 380 kcal/100 g, plátano 90 kcal/100 g (plátano mediano
 *  ≈ 120 g sin piel), aceite de coco o ghee ≈ 40 kcal la cucharadita (4,5 g), calabaza cocida 25 kcal/100 g,
 *  boniato cocido 90 kcal/100 g. Todo se multiplica por la parte que
 *  se tomó. Sirve para estimar, no para pesar. */
import type { Meal, MealSlot } from '../store/types'

export const KCAL_ALMENDRA_100ML = 14
export const KCAL_GUISANTE_100G = 380
export const KCAL_PLATANO_100G = 90
export const PLATANO_G = 120
export const KCAL_CUCHARADITA_GRASA = 40
/** Lo que se añade a veces: un poco (≈ 50 g cocidos) de calabaza o de boniato. */
export const EXTRAS_BATIDO = [
  { id: 'calabaza', label: 'calabaza', n: 'Un poco de calabaza (≈ 50 g)', k: 13 },
  { id: 'boniato', label: 'boniato', n: 'Un poco de boniato (≈ 50 g)', k: 45 },
] as const

export interface RecetaBatido { guisante_g: number; platano: number; platanoTxt: string; ml: number }
export const RECETA_BATIDO: Partial<Record<MealSlot, RecetaBatido>> = {
  media_manana: { guisante_g: 30, platano: 1 / 2, platanoTxt: '½ plátano', ml: 200 },
  merienda: { guisante_g: 15, platano: 1 / 3, platanoTxt: '⅓ de plátano', ml: 100 },
}

/** Líquido del batido si no se escribe nada en «Líquido» (13/11/2026): 200 ml media mañana, 100 ml media tarde. */
export const BATIDO_ML_TOMA: Partial<Record<MealSlot, number>> = { media_manana: 200, merienda: 100 }

export interface LineaBatido { n: string; k: number }
export interface KcalBatido { lineas: LineaBatido[]; entero: number; total: number }

/** Kilocalorías del batido de una toma: cada ingrediente del vaso entero y el total por la parte tomada. */
export function kcalBatido(slot: MealSlot, m?: Meal): KcalBatido | null {
  const r = RECETA_BATIDO[slot]
  if (!r) return null
  const ml = m?.liquid_ml != null && m.liquid_ml > 0 ? m.liquid_ml : r.ml
  const lineas: LineaBatido[] = [
    { n: `Bebida de almendras ${ml} ml`, k: Math.round((ml * KCAL_ALMENDRA_100ML) / 100) },
    { n: `Proteína de guisante ${r.guisante_g} g`, k: Math.round((r.guisante_g * KCAL_GUISANTE_100G) / 100) },
    { n: r.platanoTxt.charAt(0).toUpperCase() + r.platanoTxt.slice(1), k: Math.round((PLATANO_G * r.platano * KCAL_PLATANO_100G) / 100) },
  ]
  if (m?.fat_tsp) lineas.push({ n: '1 cucharadita de aceite de coco o ghee', k: KCAL_CUCHARADITA_GRASA })
  for (const e of EXTRAS_BATIDO) if (m?.batido_extra?.includes(e.id)) lineas.push({ n: e.n, k: e.k })
  const entero = lineas.reduce((s, l) => s + l.k, 0)
  const parte = m?.fraction != null && m.fraction > 0 ? m.fraction : 1
  return { lineas, entero, total: Math.round(entero * parte) }
}

/** Kcal previstas del batido entero (sin lo que se añade a veces), para lo previsto del día. */
export const kcalBatidoPrevisto = (slot: MealSlot) => kcalBatido(slot)?.entero ?? 0
