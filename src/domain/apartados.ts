import type { Cycle, DailyLog, Intake, Product } from '../store/types'
import { dayCompleteness, type CheckGroup, type Completeness } from './completeness'
import { medicationProgress } from './medication'

/** Los seis apartados del registro diario, en el orden en que se rellenan. */
export const APARTADOS: { to: string; ico: string; label: string; nombre: CheckGroup }[] = [
  { to: '/diario', ico: '📝', label: 'Signos', nombre: 'Signos y síntomas' },
  { to: '/medicacion', ico: '💊', label: 'Medicación', nombre: 'Medicación' },
  { to: '/nutricion', ico: '🥣', label: 'Nutrición', nombre: 'Nutrición' },
  { to: '/hidratacion', ico: '💧', label: 'Hidratación', nombre: 'Hidratación' },
  { to: '/ejercicio', ico: '🏃', label: 'Ejercicio', nombre: 'Ejercicio' },
  { to: '/biohacking', ico: '🌙', label: 'Biohacking', nombre: 'Biohacking' },
]

/** Estado de un apartado en un día: si está completo y, si no, qué le falta. */
export interface EstadoApartado {
  to: string
  ico: string
  label: string
  nombre: string
  completo: boolean
  /** Cosas que quedan por apuntar (0 si está completo). */
  faltan: number
  /** Qué falta, en una línea. */
  falta: string
}

export interface ResumenDia {
  comp: Completeness
  apartados: EstadoApartado[]
}

/** Comidas que pide la regla del registro (completeness.ts). */
const COMIDAS_MINIMAS = 3

/** 0.30.0 · Lo que queda por rellenar, apartado por apartado. No cambia qué cuenta como registrado
 *  (eso sigue en completeness.ts): solo lo agrupa por la pantalla donde se apunta. */
export function resumenDelDia(log: DailyLog | undefined, date: string, products: Product[], intakes: Intake[], cycles: Cycle[]): ResumenDia {
  const med = medicationProgress(products, intakes, cycles, date)
  const comp = dayCompleteness(log, date, med)
  const apartados = APARTADOS.map((a): EstadoApartado => {
    const pendientes = comp.items.filter((i) => i.group === a.nombre && !i.done)
    const base = { to: a.to, ico: a.ico, label: a.label, nombre: a.nombre }
    if (pendientes.length === 0) return { ...base, completo: true, faltan: 0, falta: '' }
    if (a.nombre === 'Medicación') {
      return { ...base, completo: false, faltan: Math.max(1, med.planned - med.taken), falta: `${med.taken} de ${med.planned} tomas marcadas` }
    }
    if (a.nombre === 'Nutrición') {
      const n = log?.meals?.length ?? 0
      const quedan = Math.max(1, COMIDAS_MINIMAS - n)
      return { ...base, completo: false, faltan: quedan, falta: n === 0 ? 'Ninguna comida apuntada' : `${n} ${n === 1 ? 'comida apuntada' : 'comidas apuntadas'}, ${quedan === 1 ? 'falta 1' : `faltan ${quedan}`}` }
    }
    if (a.nombre === 'Signos y síntomas') {
      return { ...base, completo: false, faltan: pendientes.length, falta: `Falta: ${pendientes.map((i) => i.label.toLowerCase()).join(', ')}` }
    }
    return { ...base, completo: false, faltan: pendientes.length, falta: `Sin apuntar: ${pendientes.map((i) => i.label.toLowerCase()).join(', ')}` }
  })
  return { comp, apartados }
}

const FECHA = /\/(\d{4}-\d{2}-\d{2})$/

/** Día que se está viendo en una pantalla del registro (`/nutricion/2026-10-10`); si no lleva fecha, hoy. */
export function fechaDeRuta(path: string, hoy: string): string {
  return FECHA.exec(path)?.[1] ?? hoy
}

/** Apartado al que pertenece una ruta, si es una pantalla del registro diario. */
export function apartadoDeRuta(path: string) {
  return APARTADOS.find((a) => path === a.to || path.startsWith(a.to + '/'))
}
