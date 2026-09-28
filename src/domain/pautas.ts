import type { Cycle } from '../store/types'
import { faseDelDia } from './fases'

/** Pautas de alimentación por tipo de quimio (textos de Montserrate, 28/09/2026, a partir del documento
 *  «Pautas de nutrición por quimio»). Se muestran en Nutrición según la semana del día que se está viendo. */

export type PautaKey = 'mtx' | 'cddp' | 'nadir'
export type { Tramo as TramoKey } from './fases'
import type { Tramo as TramoKey } from './fases'

export interface PautaSeccion {
  tramo?: TramoKey
  titulo: string
  subtitulo?: string
  /** Cada punto es texto; los que empiezan por «1. », «2. »… se muestran como lista numerada dentro del anterior. */
  puntos: (string | { texto: string; pasos: string[] })[]
}
export interface Pauta {
  key: PautaKey
  titulo: string
  semana: string
  intro: string
  secciones: PautaSeccion[]
}

export const PAUTAS: Record<PautaKey, Pauta> = {
  mtx: {
    key: 'mtx',
    titulo: 'PAUTAS DE ALIMENTACIÓN EN MTX',
    semana: 'Semana de metotrexato',
    intro: 'Metotrexato 12 g/m² en perfusión de 4 horas, con hiperhidratación intravenosa y rescate con folinato los días siguientes.',
    secciones: [
      {
        tramo: 'vispera',
        titulo: 'La víspera',
        puntos: [
          'Cena ligera, cocida y fácil de digerir.',
          'Sin agua de mar, ni la víspera ni el día del metotrexato.',
          'Agua, manzanilla o jengibre (sin limón) y caldo.',
        ],
      },
      {
        tramo: 'perfusion',
        titulo: 'El día de la perfusión',
        puntos: [
          'Desayunar antes de la quimio, por ejemplo una tortilla francesa, y empezar la perfusión 2 o 3 horas después.',
          'No comer hasta que termine la perfusión (es lo ideal; si tiene hambre o se marea, se consulta).',
          { texto: 'Al terminar, volver a comer por escalones, subiendo solo si pide más:', pasos: ['Sopa o caldo a temperatura ambiente, a sorbos.', 'Pescado blanco.', 'Puré suave.'] },
          'Si un escalón le sienta mal, se vuelve al anterior. No se le anima a comer más.',
        ],
      },
      {
        tramo: 'rescate',
        titulo: 'Los días siguientes (rescate)',
        puntos: [
          'Lo que tolere: no sobreexigir. Comida fácil de digerir.',
          '3 o 4 comidas al día.',
          'Beber bien a lo largo del día: agua, caldo, manzanilla y jengibre sin limón.',
          'La hidratación de la perfusión la pauta el hospital; en casa se vigila que orine a menudo y el pH de la orina (7 o más).',
        ],
      },
      {
        tramo: 'resto',
        titulo: 'En todas las comidas restantes de la semana',
        puntos: [
          'Todo cocido, nada crudo. Base de los platos: caldo de verduras con caldo de huesos.',
          'El plato: ½ verdura cocida (de fibra soluble: calabaza, zanahoria, calabacín, puerro, judía verde, setas y shiitake), ⅓ proteína (pescado primero, huevo, pollo, paté de sardinas) y un poco de almidón resistente (quinoa, patata o boniato cocidos y enfriados, arroz).',
          'Los «invisibles» por encima, que se suman sin sustituir nada: 2 cucharadas de aceite de oliva o sésamo crudo, ghee, tahine, semillas, huevo o proteína de guisante en el puré.',
          'Proteína en al menos 3 de las comidas del día.',
          'Sin legumbres. Menos carne roja.',
          'No dar ácido fólico, antiinflamatorios (AINE) ni protectores de estómago (IBP) sin el visto bueno de oncología: con el metotrexato es la interacción más peligrosa.',
        ],
      },
    ],
  },
  cddp: {
    key: 'cddp',
    titulo: 'PAUTAS DE ALIMENTACIÓN EN CISPLATINO + ADRIAMICINA',
    semana: 'Semana de cisplatino + adriamicina',
    intro: 'Cisplatino 120 mg/m² en perfusión continua de 48 horas, con adriamicina, en ingreso. La hidratación intravenosa (con potasio y magnesio) la pauta el hospital.',
    secciones: [
      {
        tramo: 'perfusion48',
        titulo: 'Los días de la perfusión (48 h)',
        puntos: [
          'Menos hidratos y menos grasa. Básicamente pescado y verdura, todo cocido.',
          'Almidón (patata, boniato, quinoa, arroz): poco, menos que el resto de semanas.',
          'Grasa añadida: una en lugar de dos por plato.',
          'Lo que tolere: no sobreexigir. Comida fácil de digerir, en 3 o 4 comidas.',
          'Beber: agua, chupitos de agua de mar, caldo, manzanilla y jengibre sin limón.',
        ],
      },
      {
        tramo: 'alta',
        titulo: 'Tras el alta, hasta el valle',
        puntos: [
          'Se vuelve poco a poco al plato de siempre: ½ verdura cocida, ⅓ proteína y un poco de almidón resistente, con los «invisibles» por encima.',
          'Proteína en al menos 3 comidas del día (huevo, pescado, carne blanca, proteína vegetal en polvo, yogur).',
        ],
      },
      {
        titulo: 'En todas las comidas de la semana',
        puntos: [
          'Todo cocido, nada crudo. Base de los platos: caldo de verduras con caldo de huesos.',
          'Imprescindibles: pescado, verdura de fibra soluble, shiitake, quinoa, grasas omega-3 (coco, aguacate), frutos rojos y paté de sardinas con hígado de bacalao (para evitar la pérdida de peso y músculo).',
          'Sin legumbres. Menos carne roja.',
          'Yogur de coco natural o de oveja mejor que de cabra.',
        ],
      },
    ],
  },
  nadir: {
    key: 'nadir',
    titulo: 'PAUTAS DE ALIMENTACIÓN EN SEMANA NADIR',
    semana: 'Semana nadir',
    intro: 'Valle, del día 7 al 14 tras el cisplatino.',
    secciones: [
      {
        tramo: 'nadir',
        titulo: 'Semana Nadir',
        subtitulo: 'valle, del día 7 al 14 tras el cisplatino',
        puntos: [
          '5 o 6 comidas al día. Dos de ellas, snacks de pura grasa: batido con aceite de coco, nueces de macadamia, un poco de puré con ghee, aguacate, tahine o crema de frutos secos sin azúcar.',
          'Defensas bajas: todo bien cocido; yogur solo pasteurizados; nada de leche cruda ni quesos de leche cruda; mejor comer en casa o en el hospital.',
        ],
      },
      {
        titulo: 'En todas las comidas de la semana',
        puntos: [
          'Todo cocido, nada crudo. Base de los platos: caldo de verduras con caldo de huesos.',
          'Imprescindibles: pescado, verdura de fibra soluble, shiitake, quinoa, grasas omega-3 (coco, aguacate), frutos rojos y paté de sardinas con hígado de bacalao (para evitar la pérdida de peso y músculo).',
          'Sin legumbres. Menos carne roja.',
          'Yogur de coco natural o de oveja mejor que de cabra.',
        ],
      },
    ],
  },
}

/** Qué pauta toca un día y en qué tramo está (regla de Montserrate, 28/09/2026), a partir de las sesiones
 *  del tratamiento (la fecha definitiva de Tratamiento o, si aún no está, la del protocolo):
 *  - 7 días desde el inicio del metotrexato (D0-D6) → semana de metotrexato. La víspera de un metotrexato, también.
 *  - 7 días desde el inicio del cisplatino y/o adriamicina (D0-D6) → semana de cisplatino + adriamicina.
 *  - Desde el 8.º día (D7) hasta la siguiente sesión → semana nadir.
 *  Sin quimio antes de ese día (o tras la cirugía, hasta la siguiente sesión) → null (pauta general). */
export function pautaDelDia(start: string | null | undefined, cycles: Cycle[], date: string): { pauta: PautaKey; tramo: TramoKey | null; dia: number } | null {
  const f = faseDelDia(start, cycles, date)
  if (!f) return null
  return { pauta: f.fase, tramo: f.tramo, dia: f.dia }
}
