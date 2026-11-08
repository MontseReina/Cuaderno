import type { Cycle } from '../store/types'

/** Numeración de ciclos DE CORRIDO (decisión de Montserrate, 08/11/2026): cada sesión de quimioterapia
 *  es un ciclo y se numera por orden de fecha, sin separar por fármaco ni por tandas.
 *  26/08 MTX = 1 · 02/09 CDDP+ADM = 2 · 23/09 MTX = 3 · 30/09 CDDP+ADM = 4 · ADM tras la cirugía = 5 · siguiente MTX = 6…
 *  La cirugía no cuenta como ciclo. El número guardado en la base de datos se ignora: manda el orden por fecha. */
const QUIMIO = ['MTX', 'CDDP', 'ADM', 'HDIFO']

export function esSesionDeQuimio(c: Pick<Cycle, 'drugs'>): boolean {
  return (c.drugs ?? []).some((d) => QUIMIO.includes(d))
}

export function fechaSesion(c: Pick<Cycle, 'start_at' | 'planned_date'>): string {
  return (c.start_at ?? c.planned_date ?? '').slice(0, 16)
}

/** Devuelve las mismas filas (mismo orden) con `number` recalculado de corrido. Solo crea objetos nuevos si el número cambia. */
export function numerarDeCorrido(cycles: Cycle[]): Cycle[] {
  const orden = cycles
    .filter(esSesionDeQuimio)
    .slice()
    .sort((a, b) => fechaSesion(a).localeCompare(fechaSesion(b)) || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  const num = new Map<string, number>()
  orden.forEach((c, i) => num.set(c.id, i + 1))
  let cambia = false
  const out = cycles.map((c) => {
    const n = num.get(c.id)
    if (n == null || n === c.number) return c
    cambia = true
    return { ...c, number: n }
  })
  return cambia ? out : cycles
}
