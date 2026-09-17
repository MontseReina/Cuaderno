import type { DailyLog, Meal } from '../store/types'

export function eatingWindow(meals: Meal[]) {
  const times = meals.map((m) => m.time).filter((t): t is string => !!t).sort()
  if (times.length < 2) return null
  return { first: times[0], last: times[times.length - 1], hours: hoursDiff(times[0], times[times.length - 1]) }
}
function hoursDiff(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return Math.round(((bh * 60 + bm - (ah * 60 + am)) / 60) * 10) / 10
}
/** Ayuno nocturno: desde la última ingesta de ayer hasta la primera de hoy. */
export function overnightFast(today: DailyLog | undefined, yesterday: DailyLog | undefined) {
  const last = yesterday?.meals.map((m) => m.time).filter((t): t is string => !!t).sort().pop()
  const first = today?.meals.map((m) => m.time).filter((t): t is string => !!t).sort()[0]
  if (!last || !first) return null
  return Math.round((24 - hoursDiff('00:00', last) + hoursDiff('00:00', first)) * 10) / 10
}
export function carbProfile(meals: Meal[]): 'sin datos' | 'cetogénico (orientativo)' | 'low carb (orientativo)' | 'moderado' | 'alto' {
  const w: Record<string, number> = { sin: 0, baja: 1, media: 2, alta: 3 }
  const vals = meals.map((m) => m.carb).filter((c): c is NonNullable<typeof c> => !!c)
  if (!vals.length) return 'sin datos'
  const avg = vals.reduce((a, c) => a + w[c], 0) / vals.length
  if (avg <= 0.5) return 'cetogénico (orientativo)'
  if (avg <= 1.2) return 'low carb (orientativo)'
  if (avg <= 2) return 'moderado'
  return 'alto'
}
export function meanIntake(meals: Meal[]) {
  const fr = meals.map((m) => m.fraction).filter((f): f is NonNullable<typeof f> => f != null)
  return fr.length ? (fr as number[]).reduce((a, b) => a + b, 0) / fr.length : null
}
