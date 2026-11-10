import type { Cycle } from '../store/types'
import { hoursBetween } from './dates'

/** Ayuno mínimo para que la glucemia cuente como «en ayunas»: 8 h sin ingesta calórica (criterio ADA). */
export const AYUNO_GLUCEMIA_H = 8

export interface AyunoAnalitica { horas: number; enAyunas: boolean; ciclo: number }

/** Horas entre la última comida y la extracción de la analítica de control de un ciclo. */
export function ayunoDeCiclo(c: Partial<Cycle>): AyunoAnalitica | null {
  const h = hoursBetween(c.lab_last_meal_at, c.lab_draw_at)
  if (h == null || h < 0) return null
  return { horas: h, enAyunas: h >= AYUNO_GLUCEMIA_H, ciclo: c.number ?? 0 }
}

/** Para una analítica de una fecha: el ayuno apuntado en el ciclo cuya extracción fue ese día. */
export function ayunoDeFecha(cycles: Cycle[], date: string): AyunoAnalitica | null {
  const c = cycles.find((x) => x.lab_draw_at && x.lab_draw_at.slice(0, 10) === date.slice(0, 10))
  return c ? ayunoDeCiclo(c) : null
}

export function textoAyuno(a: AyunoAnalitica) {
  return a.enAyunas
    ? `${a.horas} h de ayuno: glucemia en ayunas (≥ ${AYUNO_GLUCEMIA_H} h)`
    : `${a.horas} h de ayuno: glucemia NO en ayunas (< ${AYUNO_GLUCEMIA_H} h); puede salir más alta por la comida previa`
}
