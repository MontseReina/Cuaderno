import type { DailyLog } from '../store/types'

/** Deposiciones con un tipo de Bristol por cada una (0.28.0, pedido de Montserrate: «ayer fueron 3 cacas y de formato
 *  diferente»). Se guardan en `extra.stools`; la columna `bristol` guarda el tipo más alejado del 4 (el que más avisa
 *  de estreñimiento o diarrea), para que informes y semáforos sigan funcionando igual. */
export function tiposBristol(l?: Pick<DailyLog, 'bristol' | 'stools_n' | 'extra'> | null): number[] {
  if (!l) return []
  const lista = l.extra?.stools
  if (lista?.length) {
    const n = l.stools_n ?? lista.length
    return lista.slice(0, Math.max(n, 1)).map((s) => s.bristol).filter((b): b is number => b != null)
  }
  return l.bristol != null ? [l.bristol] : []
}

/** El tipo que más se aleja del 4 (normal); si empatan, el primero. */
export function bristolRepresentativo(tipos: (number | null | undefined)[]): number | null {
  let mejor: number | null = null
  for (const b of tipos) if (b != null && (mejor == null || Math.abs(b - 4) > Math.abs(mejor - 4))) mejor = b
  return mejor
}
