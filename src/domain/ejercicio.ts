import type { ExerciseItem } from '../store/types'

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Resumen de un ejercicio de fuerza: «2 series · 10 y 8 rep. · 10 kg». */
export function resumenEjercicio(e: ExerciseItem): string {
  const hechas = (e.series ?? []).filter((s) => s.done)
  if (!e.series) return [e.sets != null ? `${e.sets}×${e.reps ?? '?'}` : '', e.load ?? ''].filter(Boolean).join(' · ')
  if (!hechas.length) return 'ninguna serie marcada como hecha'
  const reps = hechas.map((s) => s.reps ?? '?').join(' y ')
  const kgs = Array.from(new Set(hechas.map((s) => s.kg).filter((k): k is number => k != null)))
  return `${plural(hechas.length, 'serie', 'series')} · ${reps} rep. · ${kgs.length ? kgs.join(' / ') + ' kg' : 'sin peso'}`
}

/** Campos de resumen que siguen leyendo el informe y la exportación. */
export function conResumen(e: ExerciseItem): ExerciseItem {
  const hechas = (e.series ?? []).filter((s) => s.done)
  const kg = hechas.find((s) => s.kg != null)?.kg
  return { ...e, name: e.name.trim(), sets: hechas.length, reps: hechas[0]?.reps ?? undefined, load: kg != null ? `${kg} kg` : '' }
}

