/** Proteína total en Nutrición (0.48.0; decisiones de Montserrate del 11/11 y del 13/11/2026).
 *
 *  - Se cuenta el PESO de los alimentos proteicos en cocinado (carne, pescado, marisco, huevo, leche, queso, yogur,
 *    jamón y proteína de guisante), no los gramos de proteína como nutriente: «proteína total», no efectiva.
 *  - Mínimo 120 g en cada ingesta principal (desayuno, comida y cena). Proteína del día: suma de las 5 ingestas,
 *    ideal 360-400 g.
 *  - Se calcula sola, sin que la familia añada ni elija alimentos:
 *    · desayuno, comida y cena: la proteína se pesa, 120 g cocinados (13/11); cuenta 120 g por la parte tomada
 *      (en comida y cena, la parte de proteína marcada en el plato dibujado o, si no, Entera / ¾ / Media / Casi
 *      nada). El resto del plato (patata, macarrones…) no suma;
 *    · snack del menú: cada plato suma su proteína total (dato del menú, `prot_g`, si se ha cargado) por la parte;
 *    · si se escribe otra cosa en «Otro», cuenta lo que se reconoce de lo escrito (raciones caseras);
 *    · el postre escrito suma lo que tenga de queso, yogur, etc.;
 *    · los batidos suman su proteína de guisante (30 g media mañana, 15 g media tarde) por la parte tomada. */
import { leerAlimentos } from './alimentos'
import { RECETA_BATIDO } from './batido'
import { TOMAS } from './catalogs'
import { factoresPlato, platosDeToma, tomada } from './kcal'
import type { MenuHoy } from './menu'
import type { Meal, MealSlot, MenuData, MenuDish } from '../store/types'

/** Desde este día se lleva el control (antes no se registraba así). */
export const PROTEINA_DESDE = '2026-11-11'
export const META_PRINCIPAL = 120
export const DIA_MIN = 360
export const DIA_MAX = 400
/** Por debajo de esto (⅔ de la meta) la barra de una principal va en rojo; entre esto y la meta, en ámbar. */
export const UMBRAL_AMBAR = 80
/** Desayuno, comida y cena: la proteína se pesa, 120 g cocinados. */
export const PESADA_G = 120

/** Gramos de alimento proteico de una unidad casera de lo que se escribe en «Otro» o «Postre». Solo los grupos que
 *  cuentan; lo demás (verdura, hidratos, bebida vegetal, tofu…) no suma. */
const G_UNIDAD: Record<string, number> = {
  pollo: 130, pollo_muslo: 150, codorniz: 100, bacon: 30, pavo: 130, pavo_fiambre: 50, jamon: 30, jamon_york: 30,
  ternera: 140, carne_picada: 130, hamburguesa: 120, cerdo: 130, cordero: 130, conejo: 150,
  salmon: 150, salmon_ahumado: 40, atun: 150, atun_lata: 60, sardinas: 150, caballa: 150, boquerones: 150, anchoas: 20,
  merluza: 150, lubina: 150, dorada: 150, trucha: 150, marisco: 100, mejillones: 150, calamar: 150,
  huevo: 55, huevos_revueltos: 55, tortilla: 110, proteina_polvo: 25,
  yogur: 125, yogur_griego: 125, queso: 30, queso_fresco: 60, queso_crema: 30, requeson: 50, parmesano: 10, leche: 250,
}

export type Nivel = 'verde' | 'amarillo' | 'rojo' | 'gris'
export interface LineaProt { n: string; g: number }

export interface ProteinaToma {
  slot: MealSlot
  principal: boolean
  /** Se ha marcado cuánto se tomó (o se ha escrito lo que tomó). */
  registrada: boolean
  /** Lo que lleva la ingesta entera según el menú o lo escrito (antes de la parte tomada). */
  previsto: number
  /** Gramos de alimento proteico tomados. */
  tomado: number
  /** De dónde sale lo contado. */
  lineas: LineaProt[]
  /** Hay platos del menú sin dato de proteína. */
  sinDato: string[]
  /** De dónde sale: menú, lo escrito o el batido. */
  fuente: 'menu' | 'escrito' | 'batido' | null
  /** Solo principales: frente a 120 g. */
  nivel: Nivel
}

const esPrincipal = (slot: MealSlot) => !!TOMAS.find((t) => t.key === slot)?.principal

/** Proteína total de un plato del menú: la guardada al marcar o, si no la tiene, la del menú cargado. */
const gDe = (d: MenuDish, data?: MenuData | null) => d.g ?? data?.platos[d.id]?.prot_g ?? null

/** Lo que se reconoce como alimento proteico en un texto, por unidades caseras. */
function protEscrito(texto: string | undefined, factor: (grupo: string, conNumero: boolean) => number): LineaProt[] {
  if (!texto?.trim()) return []
  return leerAlimentos(texto).leidos
    .filter((l) => G_UNIDAD[l.alimento.id] != null)
    .map((l) => ({ n: l.alimento.nombre, g: Math.round(G_UNIDAD[l.alimento.id] * l.unidades * factor(l.alimento.grupo, l.conNumero)) }))
}

export function proteinaToma(m: Meal | undefined, slot: MealSlot, menu: MenuHoy | null, data?: MenuData | null): ProteinaToma {
  const t = TOMAS.find((x) => x.key === slot)
  const principal = esPrincipal(slot)
  const f = m?.fraction
  const registrada = f != null || tomada(m)
  const parte = f != null && f > 0 ? f : f === 0 ? 0 : 1
  const r: ProteinaToma = { slot, principal, registrada, previsto: 0, tomado: 0, lineas: [], sinDato: [], fuente: null, nivel: 'gris' }

  // Lo previsto (para enseñarlo antes de marcar): el menú o el batido.
  const receta = t?.batido ? RECETA_BATIDO[slot] : undefined
  const delMenu = m ? platosDeToma(m, menu) : menu?.platos(slot) ?? []
  const snack = !!t?.batido && m?.choice === 'menu'
  if (receta && !snack) r.previsto = receta.guisante_g
  else if (t?.principal) r.previsto = PESADA_G
  else r.previsto = delMenu.reduce((s, d) => s + (gDe(d, data) ?? 0), 0)

  if (!registrada || f === 0) { r.nivel = principal && f === 0 ? 'rojo' : 'gris'; return r }

  const fPlato = t?.plato ? factoresPlato(m).prot : parte
  if (m?.note?.trim()) {
    r.fuente = 'escrito'
    r.lineas = protEscrito(m.note, (grupo, conNumero) => (conNumero ? 1 : grupo === 'proteina' ? fPlato : parte))
  } else if (receta && !snack) {
    r.fuente = 'batido'
    r.lineas = [{ n: 'Proteína de guisante', g: Math.round(receta.guisante_g * parte) }]
  } else if (t?.principal) {
    r.fuente = 'menu'
    r.lineas = [{ n: 'Proteína pesada (120 g)', g: Math.round(PESADA_G * fPlato) }]
  } else {
    r.fuente = 'menu'
    delMenu.forEach((d, i) => {
      if (i > 0 && m?.taken?.[d.id] === 'no') return
      const g = gDe(d, data)
      if (g == null) { r.sinDato.push(d.n); return }
      if (g > 0) r.lineas.push({ n: d.n, g: Math.round(g * fPlato) })
    })
  }
  if (t?.plato) r.lineas.push(...protEscrito(m?.dessert, () => 1).map((l) => ({ ...l, n: `${l.n} (postre)` })))
  r.tomado = r.lineas.reduce((s, l) => s + l.g, 0)
  r.nivel = r.tomado >= META_PRINCIPAL ? 'verde' : r.tomado >= UMBRAL_AMBAR ? 'amarillo' : 'rojo'
  return r
}

export interface ProteinaDia {
  tomas: ProteinaToma[]
  total: number
  pendientes: number
  /** Estado del total frente a 360-400 g. */
  estado: 'curso' | 'rango' | 'encima' | 'debajo'
  principalesEnMeta: number
  principalesRegistradas: number
}

export function proteinaDia(meals: Meal[], menu: MenuHoy | null, data?: MenuData | null): ProteinaDia {
  const tomas = TOMAS.map((t) => proteinaToma(meals.find((m) => m.slot === t.key), t.key, menu, data))
  const total = tomas.reduce((s, t) => s + t.tomado, 0)
  const pendientes = tomas.filter((t) => !t.registrada).length
  const estado = total > DIA_MAX ? 'encima' : total >= DIA_MIN ? 'rango' : pendientes > 0 ? 'curso' : 'debajo'
  const ps = tomas.filter((t) => t.principal)
  return {
    tomas, total, pendientes, estado,
    principalesEnMeta: ps.filter((t) => t.nivel === 'verde').length,
    principalesRegistradas: ps.filter((t) => t.registrada).length,
  }
}
